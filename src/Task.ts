import {
    CleanupInterruptionResult,
    CleanupProgressMessage,
    CleanupTaskDefinition,
    NamedTaskProvider,
    ProgressInheritance,
    ProgressInheritanceScale,
    TaskDefinition,
    TaskFunction,
    TaskInterrupter,
    TaskInterruptionFlag,
    TaskState
} from './types'
import TaskContext from './utils/TaskContext'
import {
    isNamedTaskProvider,
    isProgressInheritanceOffset,
    isProgressInheritanceOptions,
    isProgressInheritanceRange,
    isProgressInheritanceScale,
    isTaskDefinition,
    isTaskFunction,
    isTaskProvider
} from './utils'
import {DEFAULT_TASK_NAME} from './constants'
import {EventEmitter} from 'events'
import TaskInterruptionError, {isTaskInterruptionError} from './TaskInterruptionError'

export class Task<TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any>
    extends EventEmitter
    implements Promise<TResult>, NamedTaskProvider<TResult, TArgs, PMessage, IResult> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATIC METHODS ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //



    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    readonly [Symbol.toStringTag]: string

    /**
     * The name of this task.
     *
     * Will also implement the
     */
    name: string

    /**
     * Reference to the definition of this task.
     */
    protected taskDefinition: TaskDefinition<TResult, TArgs, PMessage, IResult>

    /**
     * The inner promise.
     */
    protected promise: Promise<TResult>

    /**
     * The inner reference to the interrupter.
     */
    protected interrupter?: TaskInterrupter<IResult>

    /**
     * Inner reference to the state of this task.
     */
    private _state: TaskState = TaskState.READY

    private _currentProgress: number = 0
    private _totalProgress?: number
    private _lastProgressMessage?: PMessage
    private _subTasks: SubTask<any, any[], PMessage, IResult>[] = []
    private _cleanupTasks: CleanupTask<TResult, TArgs, IResult>[] = []

    private _args?: TArgs
    private _result?: TResult
    private _failureReason?: any
    private _interruptionResult?: IResult
    private _cleaned: boolean = false

    /**
     * Creates a new task from a [[TaskDefinition]].
     *
     * @param task A [[TaskDefinition]] that describes the task you want to create.
     */
    constructor(task: TaskDefinition<TResult, TArgs, PMessage, IResult>) // TYPE 1
    /**
     * Creates a new task from a TaskDefinition.
     *
     * @param name The name of the task-function. Adds this string to the end of the `taskName` if a
     *        [[NamedTaskProvider]] was given.
     * @param task A [[TaskDefinition]] that describes the task you want to create.
     */
    constructor(name: string, task: TaskDefinition<TResult, TArgs, PMessage, IResult>) // TYPE 2
    constructor(arg0: string|TaskDefinition<TResult, TArgs, PMessage, IResult>,
                arg1?: TaskDefinition<TResult, TArgs, PMessage, IResult>) {
        super()

        // Getting the parameters
        let name: string|undefined
        let taskDefinition: TaskDefinition<TResult, TArgs, PMessage, IResult>
        if(typeof arg0 === 'string' && isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg1)) { // TYPE 1
            name = arg0
            taskDefinition = arg1
        } else if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg0)) { // TYPE 2
            name = undefined
            taskDefinition = arg0
        } else {
            throw new TypeError(`Invalid constructor call of a Task.`)
        }

        // Setting the taskDefinition
        this.taskDefinition = taskDefinition

        // Setting the taskName
        if(isNamedTaskProvider(this.taskDefinition)) {
            if(name) {
                this.name = `${this.taskDefinition.taskName}:${name}`
            } else {
                this.name = `${this.taskDefinition.taskName}`
            }
        } else if(name) {
            this.name = name
        } else {
            this.name = DEFAULT_TASK_NAME
        }

        // Setting the toStringTag
        this[Symbol.toStringTag] = `Task[${this.name}]`

        // Setting the promise
        this.promise = new Promise<TResult>(((resolve, reject) => {
            this.once('succeeded', (result: TResult) => { resolve(result) })
            this.once('failed', (reason: any) => { reject(reason) })
            this.once('interrupted', (interruptionResult: IResult) => {
                const errorMessage = `Task '${this.name}' was interrupted.`
                reject(new TaskInterruptionError(interruptionResult, errorMessage))
            })
        }))
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STARTING THE TASK ------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Starts the execution of this tasks.
     *
     * @param args The arguments you want to pass to the task.
     */
    run(...args: TArgs): this {

        // Checking if the task is ready.
        this.assertState(TaskState.READY)

        // Initialising the args.
        this._args = args

        // Getting the context.
        const context = this.createContext(...args)

        // Changing the state and emitting events.
        this.changeState(TaskState.RUNNING)
        this.emit('started', ...args)
        this.resetProgress()

        // Call the task-method.
        let result: TResult|Promise<TResult>|void
        try {
            result = this.task(context, ...args)
        } catch (e) {
            context.reject(e)
            return this
        }

        // Handling the result.
        if(typeof result === 'object' && 'then' in result && typeof result.then === 'function'
            || result instanceof Promise) {
            result.then(result => {
                if(this.isRunning) {
                    context.resolve(result)
                }
            }, reason => {
                if(this.isRunning) {
                    context.reject(reason)
                }
            })
        } else if(result) {
            context.resolve(result)
        }

        // Return itself.
        return this
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- RESULT GETTERS ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * The arguments with whom this task was called.
     */
    get args(): TArgs|undefined {
        return this._args
    }

    /**
     * The result that this task returned.
     */
    get result(): TResult|undefined {
        return this._result
    }

    get interruptionResult(): IResult|undefined {
        if(this.state === TaskState.INTERRUPTED) {
            return this._interruptionResult
        } else {
            return undefined
        }
    }

    get interruptionError(): TaskInterruptionError<IResult>|undefined {
        if(this.state === TaskState.INTERRUPTED) {
            return new TaskInterruptionError<IResult>(this.interruptionResult as IResult)
        } else {
            return undefined
        }
    }

    get failureReason(): any|undefined {
        if(this.state === TaskState.FAILED || this._failureReason !== undefined) {
            return this._failureReason
        } else if(this.state === TaskState.INTERRUPTED) {
            return this.interruptionError
        } else {
            return undefined
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- BASIC METHODS ----------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected setResult(result: TResult) {
        this.changeState(TaskState.SUCCEEDED)
        this._result = result
        this.emit('succeeded', result)
        this.finishProgress()
        this.emit('finished', TaskState.SUCCEEDED)
    }

    protected setFailure(reason: any) {
        this.changeState(TaskState.FAILED)
        this._failureReason = reason
        this.emit('failed', reason)
        this.emit('finished', TaskState.FAILED)
    }

    protected setInterrupt(interruptResult: IResult) {
        this.changeState(TaskState.INTERRUPTED)
        this._interruptionResult = interruptResult
        this.emit('interrupted', interruptResult)
        this.emit('finished', TaskState.INTERRUPTED)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- TASK CONTEXT ------------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    protected createContext(...args: TArgs): TaskContext<TResult, TArgs, PMessage, IResult> {
        return new TaskContext<TResult, TArgs, PMessage, IResult>(this, args)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- TASK HANDLERS ----------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    resolve(result: TResult): void {
        this.assertState(TaskState.RUNNING)
        this.setResult(result)
    }

    reject(reason: any): void {
        this.assertState(TaskState.RUNNING)

        if(isTaskInterruptionError<IResult>(reason)) {
            this.setInterrupt(reason.interruptionResult)
        } else {
            this.setFailure(reason)
        }
    }

    /**
     * Sets the task to the interruption state without calling the interrupter.
     *
     * @param interruptResult
     */
    softInterrupt(interruptResult: IResult): void {
        this.assertState(TaskState.RUNNING)
        this.setInterrupt(interruptResult)
    }

    setInterrupter(interrupter: TaskInterrupter<IResult>): void {
        this.interrupter = interrupter
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATE CONTROL ----------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Returns the current state of the tracker.
     */
    get state(): TaskState {
        return this._state
    }

    get isReady(): boolean {
        return this._state === TaskState.READY
    }

    get isRunning(): boolean {
        return this._state === TaskState.RUNNING
    }

    get isFailed(): boolean {
        return this._state === TaskState.FAILED
    }

    get isInterrupted(): boolean {
        return this._state === TaskState.INTERRUPTED
    }

    get isSucceeded(): boolean {
        return this._state === TaskState.SUCCEEDED
    }

    get isFinished(): boolean {
        return this.isSucceeded || this.isFailed || this.isInterrupted
    }

    /**
     * Changes the state to the provided state.
     *
     * @param state The state you want to change to.
     */
    protected changeState(state: TaskState) {
        const previousState = this._state
        this._state = state
        this.emit('stateChange', this._state, previousState)
    }

    /**
     * Asserts that this task is in one of the provided states.
     *
     * @param expectedStates
     */
    assertState(...expectedStates: TaskState[]) {
        if(expectedStates.indexOf(this.state) === -1) {
            const expectedStatesString = expectedStates.join(', ')
            throw new Error(`Task is in the wrong state. [state: ${this.state}, expected: ${expectedStatesString}]`)
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- PROGRESS ---------------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    changeProgress(currentProgress?: number, totalProgress?: number, progressMessage?: PMessage) {
        // Set default values
        if(currentProgress === undefined) {
            currentProgress = this.currentProgress
        }
        if(totalProgress === undefined) {
            totalProgress = this.totalProgress
        }

        // Check range
        if(currentProgress < 0) {
            throw new Error(`Current progress must be bigger than or equal 0.`)
        }
        if(totalProgress !== undefined && totalProgress <= 0) {
            throw new Error(`Current progress must be bigger than 0.`)
        }

        // Up totalProgress if currentProgress is bigger.
        if(totalProgress !== undefined && currentProgress > totalProgress) {
            throw new Error(`Current progress must be smaller than the total progress.`)
        }

        // Change progress and emit event if there are changes.
        if(progressMessage !== undefined
            || this.currentProgress !== currentProgress
            || this.totalProgress !== totalProgress) {
            this._currentProgress = currentProgress
            this._totalProgress = totalProgress
            if(progressMessage !== undefined) {
                this._lastProgressMessage = progressMessage
            }
            this.emit('progressUpdate', this.currentProgress, this.totalProgress, this.lastProgressMessage)
        }
    }

    /**
     * Resets the progress-properties to the default values and send a `progressUpdate`-event with those initial values.
     */
    protected resetProgress() {
        this._currentProgress = 0
        this._totalProgress = undefined
        this._lastProgressMessage = undefined
        this.emit('progressUpdate', this.currentProgress, this.totalProgress, this.lastProgressMessage)
    }


    protected finishProgress() {
        if(this.totalProgress === undefined) {
            if(this.currentProgress <= 0) {
                this._totalProgress = 1
            } else {
                this._totalProgress = this.currentProgress
            }
        }
        this.changeProgress(this.totalProgress, this.totalProgress)
    }

    /**
     * Returns the current progress of this task.
     */
    get currentProgress(): number {
        return this._currentProgress
    }

    /**
     * Returns the total progress of this task.
     */
    get totalProgress(): number|undefined {
        return this._totalProgress
    }

    get lastProgressMessage(): PMessage|undefined {
        return this._lastProgressMessage
    }

    /**
     * Returns the part of the progress that is finished by this task.
     */
    get progressFraction(): number|undefined {
        if(this.totalProgress !== undefined) {
            return this.currentProgress / this.totalProgress
        }
        return undefined
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INTERRUPTION ------------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Interrupts the execution of the task. Can be called from outside of the task.
     *
     * @param flag The type of interruption you want to perform.
     */
    interrupt(flag: TaskInterruptionFlag = TaskInterruptionFlag.DEFAULT)
        : Promise<IResult|null> {
        return new Promise<IResult|null>((resolve, reject) => {

            // Register some event-listeners
            this.once('failed', reason => reject(reason))
            this.once('interrupted', interruptionResult => resolve(interruptionResult))
            this.once('succeeded', () => resolve(null))

            // Call the interrupter
            this.callInterrupter(flag, true).catch(reject)
        })
    }

    /**
     * Calls the interrupter method if it was set.
     *
     * @param flag The flag which whom the interrupter should be called.
     * @param setState Whether or not the state of this task should be set after the interruption.
     */
    protected async callInterrupter(flag: TaskInterruptionFlag, setState: boolean = false): Promise<IResult|undefined> {
        this.assertState(TaskState.RUNNING)

        let res: IResult|undefined
        if(this.interrupter !== undefined) {
            try {
                // Call the interrupter.
                if(isTaskProvider(this.taskDefinition)) {
                    res = await this.interrupter.call(this.taskDefinition, flag)
                } else {
                    res = await this.interrupter(flag)
                }
            } catch (e) {
                // Catch the interruption error.
                if(isTaskInterruptionError(e)) {
                    res = e.interruptionResult as IResult
                } else {
                    // Rethrown the other error.
                    throw e
                }
            }

            if(setState) {
                this.setInterrupt(res)
            }
        }

        await this.interruptRunningSubTasks(flag)

        return res
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- SUB TASKS --------------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    addSubTask<SubTResult, SubTArgs extends any[]>(
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>,
        progressInheritance?: ProgressInheritance,
        name?: string
    ): SubTask<SubTResult, SubTArgs, PMessage, IResult> {

        // Creating the subTask.
        const result = new SubTask<SubTResult, SubTArgs, PMessage, IResult>(
            task,
            (this as unknown) as Task<any, any[], PMessage, IResult>,
            name
        )

        // Inherit some events
        this.inheritFailures(result)
        this.inheritProgress(result, progressInheritance)

        // Listen to subProcess update
        const subProgressListener = (progress: number, progressTotal?: number, progressMessage?: PMessage) => {
            this.emit('subProgressUpdate',
                progress,
                progressTotal,
                progressMessage,
                (result as unknown) as SubTask<unknown, unknown[], PMessage, IResult>
            )
        }
        result.on('progressUpdate', subProgressListener)
        result.once('finished', () => result.off('progressUpdate', subProgressListener))

        // Add it to the subTasks array.
        this._subTasks.push((result as unknown) as SubTask<any, any[], PMessage, IResult>)

        // Return the result
        return result
    }

    protected inheritProgress<SubTResult, SubTArgs extends any[]>(
        task: Task<SubTResult, SubTArgs, PMessage, IResult>,
        progressInheritance?: ProgressInheritance
    ): void {
        let offset: number | undefined
        let scale: number | undefined
        let inheritMessages: boolean = true
        let events: (symbol|string)[] = []
        if (isProgressInheritanceOffset(progressInheritance)) {
            offset = progressInheritance[0]
        } else if (isProgressInheritanceRange(progressInheritance)) {
            offset = progressInheritance[0]
            scale = progressInheritance[1] - progressInheritance[0]
        } else if (isProgressInheritanceScale(progressInheritance)) {
            scale = progressInheritance
        } else if (isProgressInheritanceOptions(progressInheritance)) {
            offset = progressInheritance.offset
            scale = progressInheritance.scale
            if(progressInheritance.end && progressInheritance.offset) {
                scale = progressInheritance.end - progressInheritance.offset
            }
            inheritMessages = progressInheritance.inheritMessages === undefined ? true
                                                                                : progressInheritance.inheritMessages
            if(progressInheritance.events) {
                events = progressInheritance.events
            }
        } else {
            return
        }

        const progressListener = (progress: number, progressTotal?: number, progressMessage?: PMessage) => {
            if (offset === undefined) {
                offset = this.currentProgress
            }

            if(scale === undefined) {
                this.changeProgress(progress + offset,
                    undefined,
                    inheritMessages ? progressMessage: undefined)
            } else {
                if (progressTotal === undefined) {
                    this.changeProgress(offset,
                        undefined,
                        inheritMessages ? progressMessage: undefined)
                } else {
                    const scaled = progress / progressTotal * scale
                    this.changeProgress(scaled + offset,
                        undefined,
                        inheritMessages ? progressMessage: undefined)
                }
            }
        }
        task.on('progressUpdate', progressListener)
        task.once('finished', () => task.off('progressUpdate', progressListener))

        for(const event of events) {
            const eventListener = (...args: any[]) => this.emit(event, ...args)
            task.on(event, eventListener)
            task.once('finished', () => task.off(event, eventListener))
        }
    }

    protected inheritFailures<SubTResult, SubTArgs extends any[]>(
        task: Task<SubTResult, SubTArgs, PMessage, IResult>
    ): void {
        task.once('failed', async reason => {
            if(this.state === TaskState.RUNNING) {
                const flag = TaskInterruptionFlag.FROM_FAILURE | TaskInterruptionFlag.FROM_CHILD
                const result = await this.callInterrupter(flag)
                if(result) {
                    this._interruptionResult = result
                }
                this.setFailure(reason)
            }
        })
    }

    protected interruptRunningSubTasks(
        flag: TaskInterruptionFlag = TaskInterruptionFlag.DEFAULT
    ): Promise<(IResult|undefined)[]> {
        // Call the interrupt on the tasks that are still running.
        return Promise.all(this.runningSubTasks.map(subTask => {
            return subTask.callInterrupter(flag | TaskInterruptionFlag.FROM_PARENT, true)
        }))
    }


    /**
     * Returns an array of all the sub-tasks registered on this task.
     */
    get subTasks(): SubTask<any, any[], PMessage, IResult>[] {
        return this._subTasks
    }

    get readySubTasks(): SubTask<any, any[], PMessage, IResult>[] {
        return this.subTasks.filter(subTask => subTask.isReady)
    }

    get runningSubTasks(): SubTask<any, any[], PMessage, IResult>[] {
        return this.subTasks.filter(subTask => subTask.isRunning)
    }

    get succeededSubTasks(): SubTask<any, any[], PMessage, IResult>[] {
        return this.subTasks.filter(subTask => subTask.isSucceeded)
    }

    get failedSubTasks(): SubTask<any, any[], PMessage, IResult>[] {
        return this.subTasks.filter(subTask => subTask.isFailed)
    }

    get interruptedSubTasks(): SubTask<any, any[], PMessage, IResult>[] {
        return this.subTasks.filter(subTask => subTask.isInterrupted)
    }

    get finishedSubTasks(): SubTask<any, any[], PMessage, IResult>[] {
        return this.subTasks.filter(subTask => subTask.isFinished)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- CLEANUP ----------------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    addCleanupTask(
        task: CleanupTaskDefinition<TResult, TArgs, IResult>,
        progressInheritanceScale?: ProgressInheritanceScale,
        name?: string
    ): CleanupTask<TResult, TArgs, IResult> {
        const result = new CleanupTask<TResult, TArgs, IResult>(task, name, progressInheritanceScale)
        this._cleanupTasks.push(result)
        return result
    }

    get cleaned(): boolean {
        return this._cleaned
    }

    /**
     * Returns an array of all cleanup registered on this task.
     */
    get cleanupTasks(): CleanupTask<TResult, TArgs, IResult>[] {
        return this._cleanupTasks
    }

    /**
     * Returns a TaskFunction that runs all cleanup tasks of this task.
     */
    get cleanupTask(): TaskFunction<void, [], CleanupProgressMessage, CleanupInterruptionResult> {
        return async context => {
            // Asserting the task was finished.
            this.assertState(TaskState.SUCCEEDED, TaskState.INTERRUPTED, TaskState.FAILED)

            // Checking if the task wasn't already cleaned.
            if(this.cleaned) { return }

            // Running the cleanup tasks.
            for (const cleanupTask of this.cleanupTasks) {
                await cleanupTask.run(this.failureReason, this.interruptionResult, this.result)
            }

            // Running the cleanup of the sub-tasks.
            for (const subTask of this.subTasks) {
                await context.runSubTask(`Cleanup SubTask '${this.name}'`, subTask.cleanupTask)
            }

            // Setting the has cleaned property.
            this._cleaned = true
        }
    }

    /**
     * Runs and returns the cleanup-task of this task.
     */
    cleanup(): Task<void, [], CleanupProgressMessage, CleanupInterruptionResult> {
        // Check state.
        this.assertState(TaskState.SUCCEEDED, TaskState.INTERRUPTED, TaskState.FAILED)

        // Check if task is already cleaned.
        if(this.cleaned) {
            throw new Error(`Task has already been cleaned.`)
        }

        // Creating the task.
        const result = new Task<void, [], CleanupProgressMessage, CleanupInterruptionResult>(
            `Cleanup Task '${this.name}'`,
            this.cleanupTask
        )

        // Start the cleanup and return the task.
        return result.run()
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- TASK STRUCTURE INFO ----------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected getTaskTreeLine(prefix?: number|string,
                              indent: number = 0,
                              indentString: string = '    ',
                              nameWidth: number = 60): string {
        let prefixString: string = ''
        if(prefix !== undefined) {
            prefixString = `[${prefix}]`
        }
        const padding = nameWidth - (indentString.length * indent) - prefixString.length

        return indentString.repeat(indent) + `${prefixString} ${this.name.padEnd(padding)} < state: ${this.state} >`
    }

    getSubTaskTree(prefix?: number|string, indent: number = 0, indentString: string = '    ', nameWidth: number = 60) {
        let res = this.getTaskTreeLine(prefix, indent, indentString, nameWidth) + '\n'
        for(let i = 0; i < this.subTasks.length; i++) {
            const subTask = this.subTasks[i]
            res += subTask.getSubTaskTree(i, indent + 1, indentString)
        }
        return res
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENTING: TaskProvider ---------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Executes the underlying task-function. It will run the function if a [[TaskFunction]] was given to te constructor
     * or calls the `task` method if a [[TaskProvider]] was given to the constructor.
     *
     * This method implements the `task`-method of the [[NamedTaskProvider]] interface. This makes it possible to
     * use this [[Task]] as a [[TaskProvider]].
     *
     * @param context The [[TaskContext]] for the task.
     * @param args The argument which you want to feed into the task.
     */
    task(context: TaskContext<TResult, TArgs, PMessage, IResult>, ...args: TArgs): Promise<TResult>|TResult|void {
        if(isTaskFunction<TResult, TArgs, PMessage, IResult>(this.taskDefinition)) {
            return this.taskDefinition(context, ...args)
        } else if(isTaskProvider<TResult, TArgs, PMessage, IResult>(this.taskDefinition)) {
            return this.taskDefinition.task(context, ...args)
        } else {
            throw new Error(
                `Can't run the task ${this.name}. \`taskDefinition\` was not recognised as a valid TaskDefinition.`
            )
        }
    }

    /**
     * Returns the name of the underlying [[TaskDefinition]] if it is a [[NamedTaskProvider]]. Otherwise, it returns
     * the value of the `name`-property of this task.
     *
     * This method implements the `taskName`-property of the [[NamedTaskProvider]] interface. This makes it possible to
     * use this [[Task]] as a [[TaskProvider]].
     */
    get taskName(): string {
        if(isNamedTaskProvider(this.taskDefinition)) {
            return this.taskDefinition.taskName
        } else {
            return this.name
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENTING: Promise --------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    catch<TResult1 = never>(
        onRejected?: ((reason: any) => (PromiseLike<TResult1> | TResult1)) | undefined | null
    ): Promise<TResult | TResult1> {
        return this.promise.catch(onRejected)
    }

    finally(onFinally?: (() => void) | undefined | null): Promise<TResult> {
        return this.promise.finally(onFinally)
    }

    then<TResult1 = TResult, TResult2 = never>(
        onFulfilled?: ((value: TResult) => (PromiseLike<TResult1> | TResult1)) | undefined | null,
        onRejected?: ((reason: any) => (PromiseLike<TResult2> | TResult2)) | undefined | null
    ): Promise<TResult1 | TResult2> {
        return this.promise.then(onFulfilled, onRejected)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENTING: EventEmitter ---------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    addListener(event: 'started',        listener: (...args: TArgs) => void): this
    addListener(event: 'succeeded',      listener: (result: TResult) => void): this
    addListener(event: 'failed',         listener: (reason: any) => void): this
    addListener(event: 'interrupted',    listener: (interruptionResult: IResult) => void): this
    addListener(event: 'finished',       listener: (state: TaskState) => void): this
    addListener(event: 'stateChange',    listener: (state: TaskState, previousState: TaskState) => void): this
    addListener(event: 'progressUpdate', listener: (progress: number,
                                                    progressTotal?: number,
                                                    progressMessage?: PMessage) => void): this
    addListener(event: 'subProgressUpdate', listener: (
        progress: number,
        progressTotal?: number,
        progressMessage?: PMessage,
        subTask?: SubTask<unknown, unknown[], PMessage, IResult>
    ) => void): this
    addListener(event: string|symbol, listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    addListener(event: string|symbol, listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        return super.addListener(event, listener as ((...args: any[]) => void))
    }

    on(event: 'started',        listener: (...args: TArgs) => void): this
    on(event: 'succeeded',      listener: (result: TResult) => void): this
    on(event: 'failed',         listener: (reason: any) => void): this
    on(event: 'interrupted',    listener: (interruptionResult: IResult) => void): this
    on(event: 'finished',       listener: (state: TaskState) => void): this
    on(event: 'stateChange',    listener: (state: TaskState, previousState: TaskState) => void): this
    on(event: 'progressUpdate', listener: (progress: number,
                                           progressTotal?: number,
                                           progressMessage?: PMessage) => void): this
    on(event: 'subProgressUpdate', listener: (
        progress: number,
        progressTotal?: number,
        progressMessage?: PMessage,
        subTask?: SubTask<unknown, unknown[], PMessage, IResult>
    ) => void): this
    on(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    on(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        return super.on(event, listener as ((...args: any[]) => void))
    }

    once(event: 'started',        listener: (...args: TArgs) => void): this
    once(event: 'succeeded',      listener: (result: TResult) => void): this
    once(event: 'failed',         listener: (reason: any) => void): this
    once(event: 'interrupted',    listener: (interruptionResult: IResult) => void): this
    once(event: 'finished',       listener: (state: TaskState) => void): this
    once(event: 'stateChange',    listener: (state: TaskState, previousState: TaskState) => void): this
    once(event: 'progressUpdate', listener: (progress: number,
                                             progressTotal?: number,
                                             progressMessage?: PMessage) => void): this
    once(event: 'subProgressUpdate', listener: (
        progress: number,
        progressTotal?: number,
        progressMessage?: PMessage,
        subTask?: SubTask<unknown, unknown[], PMessage, IResult>
    ) => void): this
    once(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    once(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        return super.once(event, listener as ((...args: any[]) => void))
    }

    removeListener(event: 'started',        listener: (...args: TArgs) => void): this
    removeListener(event: 'succeeded',      listener: (result: TResult) => void): this
    removeListener(event: 'failed',         listener: (reason: any) => void): this
    removeListener(event: 'interrupted',    listener: (interruptionResult: IResult) => void): this
    removeListener(event: 'finished',       listener: (state: TaskState) => void): this
    removeListener(event: 'stateChange',    listener: (state: TaskState, previousState: TaskState) => void): this
    removeListener(event: 'progressUpdate', listener: (progress: number,
                                                       progressTotal?: number,
                                                       progressMessage?: PMessage) => void): this
    removeListener(event: 'subProgressUpdate', listener: (
        progress: number,
        progressTotal?: number,
        progressMessage?: PMessage,
        subTask?: SubTask<unknown, unknown[], PMessage, IResult>
    ) => void): this
    removeListener(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    removeListener(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        return super.removeListener(event, listener as ((...args: any[]) => void))
    }

    off(event: 'started',        listener: (...args: TArgs) => void): this
    off(event: 'succeeded',      listener: (result: TResult) => void): this
    off(event: 'failed',         listener: (reason: any) => void): this
    off(event: 'interrupted',    listener: (interruptionResult: IResult) => void): this
    off(event: 'finished',       listener: (state: TaskState) => void): this
    off(event: 'stateChange',    listener: (state: TaskState, previousState: TaskState) => void): this
    off(event: 'progressUpdate', listener: (progress: number,
                                            progressTotal?: number,
                                            progressMessage?: PMessage) => void): this
    off(event: 'subProgressUpdate', listener: (
        progress: number,
        progressTotal?: number,
        progressMessage?: PMessage,
        subTask?: SubTask<unknown, unknown[], PMessage, IResult>
    ) => void): this
    off(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    off(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        return super.off(event, listener as ((...args: any[]) => void))
    }

    removeAllListeners(event?: 'started'): this
    removeAllListeners(event?: 'succeeded'): this
    removeAllListeners(event?: 'failed'): this
    removeAllListeners(event?: 'interrupted'): this
    removeAllListeners(event?: 'finished'): this
    removeAllListeners(event?: 'stateChange'): this
    removeAllListeners(event?: 'progressUpdate'): this
    removeAllListeners(event?: 'subProgressUpdate'): this
    removeAllListeners(event?: string|symbol): this
    removeAllListeners(event?: string|symbol): this {
        return super.removeAllListeners(event)
    }

    listeners(event: 'started'): Function[]
    listeners(event: 'succeeded'): Function[]
    listeners(event: 'failed'): Function[]
    listeners(event: 'interrupted'): Function[]
    listeners(event: 'finished'): Function[]
    listeners(event: 'stateChange'): Function[]
    listeners(event: 'progressUpdate'): Function[]
    listeners(event: 'subProgressUpdate'): Function[]
    listeners(event: string | symbol): Function[]
    listeners(event: string | symbol): Function[] {
        return super.listeners(event)
    }

    rawListeners(event: 'started'): Function[]
    rawListeners(event: 'succeeded'): Function[]
    rawListeners(event: 'failed'): Function[]
    rawListeners(event: 'interrupted'): Function[]
    rawListeners(event: 'finished'): Function[]
    rawListeners(event: 'stateChange'): Function[]
    rawListeners(event: 'progressUpdate'): Function[]
    rawListeners(event: 'subProgressUpdate'): Function[]
    rawListeners(event: string | symbol): Function[]
    rawListeners(event: string | symbol): Function[] {
        return super.rawListeners(event)
    }

    emit(event: 'started',        ...args: TArgs): boolean
    emit(event: 'succeeded',      result: TResult): boolean
    emit(event: 'failed',         reason: any): boolean
    emit(event: 'interrupted',    interruptionResult: IResult): boolean
    emit(event: 'finished',       state: TaskState): boolean
    emit(event: 'stateChange',    state: TaskState, previousState: TaskState): boolean
    emit(event: 'progressUpdate', progress: number, progressTotal?: number, progressMessage?: PMessage): boolean
    emit(event: 'subProgressUpdate', progress: number,
                                     progressTotal?: number,
                                     progressMessage?: PMessage,
                                     subTask?: SubTask<unknown, unknown[], PMessage, IResult>): boolean
    emit(event: string|symbol,    ...args: any[]|TArgs): boolean
    emit(event: string|symbol,    ...args: any[]|TArgs): boolean {
        return super.emit(event, ...args)
    }

    listenerCount(event: 'started'): number
    listenerCount(event: 'succeeded'): number
    listenerCount(event: 'failed'): number
    listenerCount(event: 'interrupted'): number
    listenerCount(event: 'finished'): number
    listenerCount(event: 'stateChange'): number
    listenerCount(event: 'progressUpdate'): number
    listenerCount(event: 'subProgressUpdate'): number
    listenerCount(event: string | symbol): number
    listenerCount(event: string | symbol): number {
        return super.listenerCount(event)
    }

    prependListener(event: 'started',        listener: (...args: TArgs) => void): this
    prependListener(event: 'succeeded',      listener: (result: TResult) => void): this
    prependListener(event: 'failed',         listener: (reason: any) => void): this
    prependListener(event: 'interrupted',    listener: (interruptionResult: IResult) => void): this
    prependListener(event: 'finished',       listener: (state: TaskState) => void): this
    prependListener(event: 'stateChange',    listener: (state: TaskState, previousState: TaskState) => void): this
    prependListener(event: 'progressUpdate', listener: (progress: number,
                                                        progressTotal?: number,
                                                        progressMessage?: PMessage) => void): this
    prependListener(event: 'subProgressUpdate', listener: (
        progress: number,
        progressTotal?: number,
        progressMessage?: PMessage,
        subTask?: SubTask<unknown, unknown[], PMessage, IResult>
    ) => void): this
    prependListener(event: string|symbol, listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    prependListener(event: string|symbol, listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        return super.prependListener(event, listener as ((...args: any[]) => void))
    }

    prependOnceListener(event: 'started',        listener: (...args: TArgs) => void): this
    prependOnceListener(event: 'succeeded',      listener: (result: TResult) => void): this
    prependOnceListener(event: 'failed',         listener: (reason: any) => void): this
    prependOnceListener(event: 'interrupted',    listener: (interruptionResult: IResult) => void): this
    prependOnceListener(event: 'finished',       listener: (state: TaskState) => void): this
    prependOnceListener(event: 'stateChange',    listener: (state: TaskState, previousState: TaskState) => void): this
    prependOnceListener(event: 'progressUpdate', listener: (progress: number,
                                                            progressTotal?: number,
                                                            progressMessage?: PMessage) => void): this
    prependOnceListener(event: 'subProgressUpdate', listener: (
        progress: number,
        progressTotal?: number,
        progressMessage?: PMessage,
        subTask?: SubTask<unknown, unknown[], PMessage, IResult>
    ) => void): this
    prependOnceListener(event: string|symbol, listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    prependOnceListener(event: string|symbol, listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        return super.prependOnceListener(event, listener as ((...args: any[]) => void))
    }

}


export class SubTask<TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any>
    extends Task<TResult, TArgs, PMessage, IResult> {

    readonly parent: Task<any, any[], PMessage, IResult>

    constructor(task: TaskDefinition<TResult, TArgs, PMessage, IResult>,
                parent: Task<any, any[], PMessage, IResult>,
                name?: string) {
        if(name) {
            super(name, task)
        } else {
            super(task)
        }

        this.parent = parent
    }

}

export class CleanupTask<TResult = void, TArgs extends any[] = [], IResult = any>
    extends Task<void,
        [any|undefined, IResult|undefined, TResult|undefined],
        CleanupProgressMessage,
        CleanupInterruptionResult> {

    progressWeight: number

    constructor(
        task: CleanupTaskDefinition<TResult, TArgs, IResult>,
        name?: string,
        progressWeight: ProgressInheritanceScale = 1
    ) {
        if(name) {
            super(name, task)
        } else {
            super(task)
        }
        this.progressWeight = progressWeight
    }

}
