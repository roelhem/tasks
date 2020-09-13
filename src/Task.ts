import {
    ChildProcessEvents,
    CleanupInterruptionResult,
    CleanupProgressMessage,
    CleanupTaskDefinition,
    NamedTaskProvider,
    ProgressInheritance,
    TaskDefinition,
    TaskEvents,
    TaskFunction,
    TaskInterrupter,
    TaskInterruptionFlag,
    TaskState
} from './types'
import { throttle } from 'throttle-debounce'
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

export type CleanupTask<TResult = void, TArgs extends any[] = [], IResult = any> = Task<
    void,
    [any|undefined, IResult|undefined, TResult|undefined],
    CleanupProgressMessage,
    CleanupInterruptionResult
>

export class Task<TResult = any, TArgs extends any[] = [], PMessage = any, IResult = any>
    implements Promise<TResult>, EventEmitter, NamedTaskProvider<TResult, TArgs, PMessage, IResult> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATIC METHODS ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    static readonly buildInEvents: (keyof TaskEvents|keyof ChildProcessEvents)[] = [
        'started',
        'succeeded',
        'failed',
        'interrupted',
        'finished',
        'stateChange',
        'newCustomEvent',
        'progressUpdate',
        'subProgressUpdate',
        'cleanupStarted',
        'cleanupFailed',
        'cleanupSucceeded',
        'cleanupFinished',
        'cleanupInterrupted',
        'cleanupFinished',
        'cleanupStateChange',
        'cleanupProgressUpdate',
        'close',
        'disconnect',
        'exit',
        'error',
        'message',
        'line',
    ]

    static removeListenersWhenFinished: boolean = true

    static defaultProgressThrottle: number = 100

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    readonly [Symbol.toStringTag]: string

    /**
     * A list of custom events that this [[Task]] can emit.
     */
    readonly customEvents: (string|symbol)[]

    /**
     * The name of this task.
     *
     * Will also implement the
     */
    name: string

    /**
     * A function that will be called on the [[Task]] when the task is initialized.
     */
    taskSetup: (task: Task<TResult, TArgs, PMessage, IResult>) => void

    /**
     * Limits the amount of progress-updates.
     *
     * See: [throttle-debounce](https://www.npmjs.com/package/throttle-debounce)
     */
    readonly progressThrottle: number

    /**
     * Reference to the definition of this task.
     */
    protected taskDefinition: TaskDefinition<TResult, TArgs, PMessage, IResult>

    /**
     * The inner reference to the interrupter.
     */
    protected interrupters: Set<TaskInterrupter<IResult>>

    /**
     * The inner reference to the EventEmitter.
     */
    protected readonly eventEmitter: EventEmitter

    /**
     * Inner reference to the state of this task.
     */
    private _state: TaskState // = TaskState.READY

    /**
     * The parent of this [[Task]] if it is a subTask. Will be `null` if this [[Task]] is a rootTask.
     */
    protected _parentTask: Task<any, any[], PMessage, IResult>|null

    private _currentProgress: number // = 0
    private _totalProgress?: number
    private _lastProgressMessage?: PMessage
    private readonly _subTasks: Task<any, any[], PMessage, IResult>[]
    private readonly _cleanupTasks: CleanupTask<TResult, TArgs, IResult>[]
    private readonly _promise: Promise<TResult>

    private _args?: TArgs
    private _result?: TResult
    private _failureReason?: any
    private _interruptionResult?: IResult
    private _cleaned: boolean // = false

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
    constructor(name: string,
                task: TaskDefinition<TResult, TArgs, PMessage, IResult>) // TYPE 2
    constructor(arg0: string|TaskDefinition<TResult, TArgs, PMessage, IResult>,
                arg1?: TaskDefinition<TResult, TArgs, PMessage, IResult>) {
        // Initialize the EventEmitter
        this.eventEmitter = new EventEmitter()

        // Set the properties with a static initial value
        this._parentTask = null
        this.customEvents = []
        this._state = TaskState.READY
        this._currentProgress = 0
        this._subTasks = []
        this._cleanupTasks = []
        this._cleaned = false

        // Initialize the throttle
        this.progressThrottle = Task.defaultProgressThrottle

        // Initialize the interrupters set
        this.interrupters = new Set()

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

        // Set the toStringTag.
        this[Symbol.toStringTag] = `${this.constructor.name}[${this.name}]`

        // Initialize the promis
        this._promise = new Promise((resolve, reject) => {
            this.once('succeeded', (result: TResult) => { resolve(result) })
            this.once('failed', (reason: any) => { reject(reason) })
            this.once('interrupted', (interruptionResult: IResult) => {
                const errorMessage = `Task '${this.name}' was interrupted.`
                reject(new TaskInterruptionError(interruptionResult, errorMessage))
            })
        })

        // Calling the setup function if exists.
        this.taskSetup = (task) => taskDefinition.taskSetup ? taskDefinition.taskSetup(task) : undefined
        this.taskSetup(this)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STARTING THE TASK ------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Starts the execution of this [[Task]].
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
    // ---- TASK TYPE GETTERS ------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Gives the parent task of this task. Will be `null` if this task is a rootTask.
     */
    get parentTask(): Task<any, any[], PMessage, IResult>|null {
        return this._parentTask
    }

    /**
     * Returns `true` if this [[Task]] is a rootTask, which means that it has no parent.
     */
    get isRootTask(): boolean {
        return this.parentTask === null
    }

    /**
     * Returns `true` if this [[Task]] is a subTask, which means that it has a parent.
     */
    get isSubTask(): boolean {
        return !this.isRootTask
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
        this.finish()
    }

    protected setFailure(reason: any) {
        this.changeState(TaskState.FAILED)
        this._failureReason = reason
        this.emit('failed', reason)
        this.finish()
    }

    protected setInterrupt(interruptResult: IResult) {
        this.changeState(TaskState.INTERRUPTED)
        this._interruptionResult = interruptResult
        this.emit('interrupted', interruptResult)
        this.finish()
    }

    protected finish() {
        this.emit('finished', this.state)
        if(Task.removeListenersWhenFinished) {
            this.removeAllListeners()
        }
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
            this.emitProgressUpdate(this.currentProgress, this.totalProgress, this.lastProgressMessage)
        }
    }

    private _emitProgressUpdate?: (current: number, total?: number, message?: PMessage) => boolean
    protected get emitProgressUpdate(): (current: number, total?: number, message?: PMessage) => boolean {
        if(!this._emitProgressUpdate) {
            const result = throttle(this.progressThrottle, (current, total, message) => {
                return this.emit('progressUpdate', current, total, message)
            })
            this.once('finished', () => result.cancel())
            this._emitProgressUpdate = result
        }
        return this._emitProgressUpdate
    }

    /**
     * Resets the progress-properties to the default values and send a `progressUpdate`-event with those initial values.
     */
    protected resetProgress() {
        this._currentProgress = 0
        this._totalProgress = undefined
        this._lastProgressMessage = undefined
        this.emitProgressUpdate(this.currentProgress, this.totalProgress, this.lastProgressMessage)
    }

    /**
     * Function that should be called when the task is finished. It will set the [[currentProgress]] to
     * the value of [[totalProgress]].
     */
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

    /**
     * Returns the last progress-message that was send.
     */
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
        return new Promise<IResult|null>(async (resolve, reject) => {

            try {
                // Call the interrupter if the task is running
                if(this.isRunning) {
                    await this.callInterrupter(flag, true)
                }

                // Immediately resolve when task has already been finished
                if(this.isFinished) {
                    if(this.isInterrupted) {
                        resolve(this.interruptionResult)
                    } else if(this.isFinished) {
                        resolve(null)
                    }
                } else {
                    // Register some event-listeners
                    this.once('failed', reason => reject(reason))
                    this.once('interrupted', interruptionResult => resolve(interruptionResult))
                    this.once('succeeded', () => resolve(null))
                }
            } catch (e) {
                reject(e)
            }


        })
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

    /**
     * Calls the interrupter method if it was set.
     *
     * @param flag The flag which whom the interrupter should be called.
     * @param setState Whether or not the state of this task should be set after the interruption.
     */
    protected async callInterrupter(flag: TaskInterruptionFlag, setState: boolean = false): Promise<IResult|undefined> {
        this.assertState(TaskState.RUNNING)

        let res: IResult|undefined
        if(this.interrupters.size > 0) {
            try {
                const results = await Promise.all(
                    [...this.interrupters].map(interrupter => {
                        if(isTaskProvider(this.taskDefinition)) {
                            return interrupter.call(this.taskDefinition, flag)
                        } else {
                            return interrupter(flag)
                        }
                    })
                )
                res = results[results.length - 1]
            } catch (e) {
                if(isTaskInterruptionError(e)) {
                    res = e.interruptionResult as IResult
                } else {
                    throw e
                }
            }

            if(setState) {
                this.setInterrupt(res as IResult)
            }
        }


        await this.interruptRunningSubTasks(flag)

        return res
    }

    /**
     * Add an interrupter to the task.
     * @param interrupter The interrupter you want to add.
     */
    addInterrupter(interrupter: TaskInterrupter<IResult>): this {
        this.interrupters.add(interrupter)
        return this
    }

    /**
     * Remove an interrupter from the task.
     * @param interrupter The interrupter you want to add
     */
    deleteInterrupter(interrupter: TaskInterrupter<IResult>): boolean {
        return this.interrupters.delete(interrupter)
    }

    /**
     * Removes all interrupters from the task.
     */
    clearInterrupters(): this {
        this.interrupters.clear()
        return this
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- SUB TASKS --------------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    addSubTask<SubTResult, SubTArgs extends any[]>(
        task: Task<SubTResult, SubTArgs, PMessage, IResult>,
        progressInheritance?: ProgressInheritance
    ): Task<SubTResult, SubTArgs, PMessage, IResult> {

        if(task.state !== TaskState.READY) {
            throw new Error(`You can't add a subTask that is not in the 'READY'-state.`)
        }

        // Setting the parent on the SubTask to this task.
        task._parentTask = this as any

        // Inherit some events
        this.inheritFailures(task)
        this.inheritProgress(task, progressInheritance)

        // Listen to subProcess update
        task.on('progressUpdate', (progress, progressTotal, progressMessage) => {
            this.emit('subProgressUpdate',
                progress,
                progressTotal,
                progressMessage,
                task
            )
        })

        // Inherit custom events
        task.on('newCustomEvent', (event) => {
            task.on(event, (...args: any[]) => this.emit(event, ...args))
        })

        // Add it to the subTasks array.
        this._subTasks.push(task as any)

        // Return the task
        return task
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

        task.on('progressUpdate', (progress, progressTotal, progressMessage) => {
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
        })

        for(const event of events) {
            task.on(event, (...args: any[]) => this.emit(event, ...args))
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
    get subTasks(): Task<any, any[], PMessage, IResult>[] {
        return this._subTasks
    }

    get readySubTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.subTasks.filter(subTask => subTask.isReady)
    }

    get runningSubTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.subTasks.filter(subTask => subTask.isRunning)
    }

    get succeededSubTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.subTasks.filter(subTask => subTask.isSucceeded)
    }

    get failedSubTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.subTasks.filter(subTask => subTask.isFailed)
    }

    get interruptedSubTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.subTasks.filter(subTask => subTask.isInterrupted)
    }

    get finishedSubTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.subTasks.filter(subTask => subTask.isFinished)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- CLEANUP ----------------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    addCleanupTask(
        task: CleanupTaskDefinition<TResult, TArgs, IResult>,
    ): CleanupTask<TResult, TArgs, IResult>
    addCleanupTask(
        name: string,
        task: CleanupTaskDefinition<TResult, TArgs, IResult>,
    ): CleanupTask<TResult, TArgs, IResult>
    addCleanupTask(
        arg0: string|CleanupTaskDefinition<TResult, TArgs, IResult>,
        arg1?: CleanupTaskDefinition<TResult, TArgs, IResult>
    ): CleanupTask<TResult, TArgs, IResult> {
        // Get the parameters
        const taskDefinition = typeof arg0 === 'string' ? arg1 : arg0
        const name = typeof arg0 === 'string' ? arg0 : undefined
        // Throw error if taskDefinition is undefined.
        if(taskDefinition === undefined) {
            throw new TypeError(`No TaskDefinition Provided.`)
        }
        // Get the CleanupTask
        const cleanupTask: CleanupTask<TResult, TArgs, IResult> =
            taskDefinition instanceof Task && taskDefinition.state === TaskState.READY ? taskDefinition :
                typeof name === 'string' ? new Task(name, taskDefinition) : new Task(taskDefinition)
        this._cleanupTasks.push(cleanupTask)
        return cleanupTask
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
     *
     * First, the [[cleanupTask]] of the subTasks will be executed in reversed order. (So the last added subTask will
     * be executed first.)
     * Then, the  [[cleanupTasks]] of this [[Task]] will be executed in reversed order. (So the last added cleanupTask
     * will be executed first.)
     */
    get cleanupTask(): TaskFunction<void, [], CleanupProgressMessage, CleanupInterruptionResult> {
        return async context => {
            // Asserting the task was finished.
            this.assertState(TaskState.SUCCEEDED, TaskState.INTERRUPTED, TaskState.FAILED)

            // Checking if the task wasn't already cleaned.
            if(this.cleaned) { return }

            // Running the cleanup of the sub-tasks, in reversed order. (LIFO)
            for (const subTask of this.subTasks.reverse()) {
                await context.runSubTask(`Cleanup SubTask '${this.name}'`, subTask.cleanupTask)
            }

            // Running the cleanup tasks, in reversed order. (LIFO)
            for (const cleanupTask of this.cleanupTasks.reverse()) {
                await cleanupTask.run(this.failureReason, this.interruptionResult, this.result)
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

        // Forward events.
        result.once('started', this.emitLambda('cleanupStarted'))
        result.once('succeeded', this.emitLambda('cleanupSucceeded'))
        result.once('failed', this.emitLambda('cleanupFailed'))
        result.once('interrupted', this.emitLambda('cleanupInterrupted'))
        result.once('finished', this.emitLambda('cleanupFinished'))
        result.on('stateChange', this.emitLambda('cleanupStateChange'))
        result.on('progressUpdate', this.emitLambda('cleanupProgressUpdate'))

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
    // ---- EVENTS ------------------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Returns a list of all the events that this task could emit.
     */
    get events(): (string|symbol)[] {
        return [...Task.buildInEvents, ...this.customEvents]
    }

    /**
     * Returns whether or not the provided event is a new event.
     *
     * @param event The key of the event for which you want to check.
     */
    eventIsNew(event: string|symbol): boolean {
        return !Task.buildInEvents.includes(event as any) && !this.customEvents.includes(event as any)
    }

    /**
     * Registers a new event if it isn't registered yet.
     *
     * When the provided event isn't yet in the `Task.buildInEvents` or `this.customEvents`, it will be added to
     * the custom events and a `newCustomEvent` event will be emitted.
     *
     * @param event The event that you want to register.
     */
    registerEvent(event: string|symbol): this {
        if(this.eventIsNew(event)) {
            this.customEvents.push(event)
            this.eventEmitter.emit('newCustomEvent', event)
        }
        return this
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENTING: EventEmitter ---------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    addListener<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    addListener(event: string|symbol, listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    addListener(event: string|symbol, listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        this.eventEmitter.addListener(event, listener as ((...args: any[]) => void))
        return this
    }

    on<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    on(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    on(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        this.eventEmitter.on(event, listener as ((...args: any[]) => void))
        return this
    }

    once<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    once(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    once(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        this.eventEmitter.once(event, listener as ((...args: any[]) => void))
        return this
    }

    removeListener<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    removeListener(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    removeListener(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        this.eventEmitter.removeListener(event, listener as ((...args: any[]) => void))
        return this
    }

    off<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    off(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    off(event: string|symbol,    listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        this.eventEmitter.off(event, listener as ((...args: any[]) => void))
        return this
    }

    removeAllListeners<K extends keyof TaskEvents>(event?: K): this
    removeAllListeners(event?: string|symbol): this
    removeAllListeners(event?: string|symbol): this {
        this.eventEmitter.removeAllListeners(event)
        return this
    }

    listeners<K extends keyof TaskEvents>(event: K): Function[]
    listeners(event: string | symbol): Function[]
    listeners(event: string | symbol): Function[] {
        return this.eventEmitter.listeners(event)
    }

    rawListeners<K extends keyof TaskEvents>(event: K): Function[]
    rawListeners(event: string | symbol): Function[]
    rawListeners(event: string | symbol): Function[] {
        return this.eventEmitter.rawListeners(event)
    }

    emit<K extends keyof TaskEvents>(event: K, ...args: Parameters<TaskEvents[K]>): boolean
    emit(event: string|symbol,    ...args: any[]|TArgs): boolean
    emit(event: string|symbol,    ...args: any[]|TArgs): boolean {
        this.registerEvent(event)
        return this.eventEmitter.emit(event, ...args)
    }

    listenerCount<K extends keyof TaskEvents>(event: K): number
    listenerCount(event: string | symbol): number
    listenerCount(event: string | symbol): number {
        return this.eventEmitter.listenerCount(event)
    }

    prependListener<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    prependListener(event: string|symbol, listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    prependListener(event: string|symbol, listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        this.eventEmitter.prependListener(event, listener as ((...args: any[]) => void))
        return this
    }

    prependOnceListener<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    prependOnceListener(event: string|symbol, listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this
    prependOnceListener(event: string|symbol, listener: ((...args: any[]) => void)|((...args: TArgs) => void)): this {
        this.eventEmitter.prependOnceListener(event, listener as ((...args: any[]) => void))
        return this
    }

    eventNames(): (keyof TaskEvents | string | symbol)[] {
        return this.eventEmitter.eventNames()
    }

    getMaxListeners(): number {
        return this.eventEmitter.getMaxListeners()
    }

    setMaxListeners(n: number): this
    setMaxListeners(n: number): this
    setMaxListeners(n: number): this {
        this.eventEmitter.setMaxListeners(n)
        return this
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- EventEmitter Helpers ---------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Calls the [[emit]] method in Lambda-calculus style.
     * @param event The event you want to emit.
     */
    emitLambda<K extends keyof TaskEvents>(event: K): TaskEvents[K]
    emitLambda(event: string|symbol): ((...args: any[]) => boolean)
    emitLambda(event: string|symbol): ((...args: any[]) => boolean) {
        return (...args: any[]) => this.emit(event, ...args)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENT: Promise ------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    catch<R = never>(onRejected?: ((reason: any) => (PromiseLike<R> | R)) | undefined | null): Promise<R | TResult> {
        return this._promise.catch(onRejected)
    }

    finally(onFinally?: (() => void) | undefined | null): Promise<TResult> {
        return this._promise.catch(onFinally) as any
    }

    then<R1 = TResult, R2 = never>(
        onFulfilled?: ((value: TResult) => (PromiseLike<R1> | R1)) | undefined | null,
        onRejected?: ((reason: any) => (PromiseLike<R2> | R2)) | undefined | null
    ): Promise<R1 | R2> {
        return this._promise.then(onFulfilled, onRejected)
    }

}

// Set the promise as it's prototype
// Task.constructor
