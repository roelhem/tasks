import {CleanupTask, Task} from '../Task'
import {
    ChildProcessOptions,
    ChildProcessProvider,
    CleanupTaskDefinition,
    ProgressInheritance,
    TaskDefinition,
    TaskInterrupter,
    TaskState
} from '../types'
import {isProgressInheritance, isTaskDefinition} from './checkers'

type ChildProcess<PData extends {} = {}, PMessage = any, IResult = any> =
    import('../ChildProcess').default<PData, PMessage, IResult>
type ChildProcessConstructor<PData extends {} = {}, PMessage = any, IResult = any> = {
    new (provider: ChildProcessProvider<PData, PMessage, IResult>): ChildProcess<PData, PMessage, IResult>
    new (executable: string,
         options?: ChildProcessOptions<PData, PMessage, IResult>): ChildProcess<PData, PMessage, IResult>
}

export default class TaskContext<TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATIC CONSTRUCTORS ----------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    static empty<TResult = void,
                 TArgs extends any[] = [],
                 PMessage = string,
                 IResult = any>(...args: TArgs): TaskContext<TResult, TArgs, PMessage, IResult> {
        const emptyTask = new Task<TResult, TArgs, PMessage, IResult>(() => { return })
        return new TaskContext<TResult, TArgs, PMessage, IResult>(emptyTask, args)
    }

    private static _ChildProcess?: ChildProcessConstructor
    protected static get ChildProcess(): ChildProcessConstructor {
        if(!this._ChildProcess) {
            this._ChildProcess = require('../ChildProcess').default as ChildProcessConstructor
        }
        return this._ChildProcess
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * A reference to the current task.
     */
    readonly task: Task<TResult, TArgs, PMessage, IResult>

    /**
     * The arguments with whom this task was called.
     */
    readonly args: TArgs

    constructor(task: Task<TResult, TArgs, PMessage, IResult>, args: TArgs) {
        this.task = task
        this.args = args
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- TASK TERMINATORS -------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Method that should be called from the task when an error occurred during the execution of the task.
     *
     * @param reason The reason for the error. Is an `Error`-object in most cases.
     */
    reject(reason: any): this {
        this.task.reject(reason)
        return this
    }

    /**
     * Method that should be called from the task when the task has found it's result.
     *
     * @param result The result of the task
     */
    resolve(result: TResult): this {
        this.task.resolve(result)
        return this
    }

    /**
     * Method that should be called when the task is interrupted.
     *
     * @param interruptResult A description of the point where the task was interrupted.
     */
    interrupt(interruptResult: IResult): this {
        this.task.softInterrupt(interruptResult)
        return this
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INTERRUPTION CONTROL ---------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Sets the interrupter function. This function will be called when the task is interrupted from outside of the
     * task definition.
     *
     * @param interrupter The interrupter method.
     */
    addInterrupter(interrupter: TaskInterrupter<IResult>): this {
        this.task.addInterrupter(interrupter)
        return this
    }

    deleteInterrupter(interrupter: TaskInterrupter<IResult>): boolean {
        return this.task.deleteInterrupter(interrupter)
    }

    clearInterrupters(): this {
        this.task.clearInterrupters()
        return this
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- PROGRESS CONTROL -------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    setProgressTotal(total: number, message?: PMessage): this {
        this.task.changeProgress(undefined, total, message)
        return this
    }
    setProgressMessage(message: PMessage): this {
        this.task.changeProgress(undefined, undefined, message)
        return this
    }
    setProgress(progress: number, total?: number, message?: PMessage): this {
        this.task.changeProgress(progress, total, message)
        return this
    }

    incrementProgress(amount: number, total?: number, message?: PMessage): this {
        const prevCurrent = this.task.currentProgress
        const nextCurrent = prevCurrent + amount
        const proposedTotal = total || this.task.totalProgress
        const nextTotal = proposedTotal === undefined ? undefined :
                         (proposedTotal < nextCurrent ? nextCurrent : proposedTotal)
        this.task.changeProgress(nextCurrent, nextTotal, message)
        return this
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- EMITTING CONTROL -------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    emit(event: string, ...args: any[]): this {
        this.task.emit(event, ...args)
        return this
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- SUB TASKS --------------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected getSubTaskArgs<SubTResult = any, SubTArgs extends any[] = []>(
        arg0: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|string|ProgressInheritance,
        arg1?: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|string|any,
        arg2?: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|any,
        ...otherArgs: any[]
    ): {
        taskDefinition: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>
        name: string|undefined
        progressInheritance: ProgressInheritance|undefined
        args: SubTArgs
    } {
        // Get the right properties
        let taskDefinition: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>
        let name: string|undefined
        let progressInheritance: ProgressInheritance|undefined
        let args: SubTArgs
        if(isTaskDefinition(arg0)) {
            taskDefinition = arg0
            args = [arg1, arg2, ...otherArgs] as SubTArgs
        } else if(isTaskDefinition(arg1)) {
            taskDefinition = arg1
            args = [arg2, ...otherArgs] as SubTArgs
            if(isProgressInheritance(arg0)) {
                progressInheritance = arg0
            }
            if(typeof arg0 === 'string') {
                name = arg0
            }
        } else if(isTaskDefinition(arg2)) {
            taskDefinition = arg2
            args = otherArgs as SubTArgs
            if(isProgressInheritance(arg0)) {
                progressInheritance = arg0
            }
            if(typeof arg1 === 'string') {
                name = arg1
            }
        } else {
            throw new TypeError(`No TaskDefinition provided.`)
        }

        // Remove trailing undefined args
        while (args.length > 0 && args[args.length - 1] === undefined) {
            args.pop()
        }

        // Return the result
        return {
            taskDefinition,
            name,
            progressInheritance,
            args,
        }
    }

    addSubTask<SubTResult = any, SubTArgs extends any[] = []>(
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>
    ): Task<SubTResult, SubTArgs, PMessage, IResult>
    addSubTask<SubTResult = any, SubTArgs extends any[] = []>(
        name: string,
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>
    ): Task<SubTResult, SubTArgs, PMessage, IResult>
    addSubTask<SubTResult = any, SubTArgs extends any[] = []>(
        progressInheritance: ProgressInheritance,
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>
    ): Task<SubTResult, SubTArgs, PMessage, IResult>
    addSubTask<SubTResult = any, SubTArgs extends any[] = []>(
        progressInheritance: ProgressInheritance,
        name: string,
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>
    ): Task<SubTResult, SubTArgs, PMessage, IResult>
    addSubTask<SubTResult, SubTArgs extends any[]>(
        arg0: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|string|ProgressInheritance,
        arg1?: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|string,
        arg2?: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>
    ): Task<SubTResult, SubTArgs, PMessage, IResult> {
        // Determine the parameters.
        const {taskDefinition, name, progressInheritance} = this.getSubTaskArgs(arg0, arg1, arg2)

        // Get the SubTask, add it to the parent and return it.
        const task = taskDefinition instanceof Task && taskDefinition.state === 'READY' ? taskDefinition :
            typeof name === 'string' ? new Task(name, taskDefinition) : new Task(taskDefinition)
        return this.task.addSubTask(task, progressInheritance)
    }

    runSubTask<SubTResult = void, SubTArgs extends any[] = []>(
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>,
        ...args: SubTArgs
    ): Task<SubTResult, SubTArgs, PMessage, IResult>
    runSubTask<SubTResult = void, SubTArgs extends any[] = []>(
        name: string,
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>,
        ...args: SubTArgs
    ): Task<SubTResult, SubTArgs, PMessage, IResult>

    runSubTask<SubTResult = void, SubTArgs extends any[] = []>(
        progressInheritance: ProgressInheritance,
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>,
        ...args: SubTArgs
    ): Task<SubTResult, SubTArgs, PMessage, IResult>

    runSubTask<SubTResult = void, SubTArgs extends any[] = []>(
        progressInheritance: ProgressInheritance,
        name: string,
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>,
        ...args: SubTArgs
    ): Task<SubTResult, SubTArgs, PMessage, IResult>
    runSubTask<SubTResult, SubTArgs extends any[]>(
        arg0: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|string|ProgressInheritance,
        arg1?: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|string|any,
        arg2?: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|any,
        ...otherArgs: any[]
    ): Task<SubTResult, SubTArgs, PMessage, IResult> {
        // Determine the parameters.
        const {taskDefinition, name, progressInheritance, args} = this.getSubTaskArgs(arg0, arg1, arg2, ...otherArgs)

        // Get the SubTask, add it to the parent, call run and return it.
        const task = taskDefinition instanceof Task && taskDefinition.state === 'READY' ? taskDefinition :
            typeof name === 'string' ? new Task(name, taskDefinition) : new Task(taskDefinition)
        return this.task.addSubTask(task, progressInheritance).run(...args)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- CLEANUP TASKS ----------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    addCleanupTask(
        cleanupTask: CleanupTaskDefinition<TResult, TArgs, IResult>
    ): CleanupTask<TResult, TArgs, IResult>
    addCleanupTask(
        name: string,
        cleanupTask: CleanupTaskDefinition<TResult, TArgs, IResult>
    ): CleanupTask<TResult, TArgs, IResult>
    addCleanupTask (
        arg0: CleanupTaskDefinition<TResult, TArgs, IResult>|string,
        arg1?: CleanupTaskDefinition<TResult, TArgs, IResult>
    ): CleanupTask<TResult, TArgs, IResult> {
        if(isTaskDefinition(arg0)) {
            return this.task.addCleanupTask(arg0)
        } else if(isTaskDefinition(arg1)) {
            return this.task.addCleanupTask(arg0 as string, arg1)
        } else {
            throw new TypeError(`No CleanupTaskDefinition provided.`)
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- CHILD PROCESSES --------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected getChildProcess<PData extends {} = {}>(
        arg0: string|ChildProcessProvider<PData, PMessage, IResult>|ProgressInheritance,
        arg1?: string|ChildProcessProvider<PData, PMessage, IResult>|ChildProcessOptions<PData, PMessage, IResult>,
        arg2?: string|ChildProcessOptions<PData, PMessage, IResult>,
        ...otherArgs: string[]
    ): {
        childProcess: ChildProcess<PData, PMessage, IResult>
        args: string[]
        progressInheritance: ProgressInheritance|undefined
    } {
        // Get the arguments
        let executable: string|undefined
        let provider: ChildProcessProvider<PData, PMessage, IResult>|undefined
        let options: ChildProcessOptions<PData, PMessage, IResult>|undefined
        let progressInheritance: ProgressInheritance|undefined
        const args: string[] = []
        if(isProgressInheritance(arg0)) {
            progressInheritance = arg0
            if(typeof arg1 === 'string') {
                executable = arg1
                if(typeof arg2 !== 'string') {
                    options = arg2
                } else {
                    args.push(arg2)
                }
                args.push(...otherArgs)
            } else if(arg1 !== undefined && 'executable' in arg1 && arg1.executable !== undefined) {
                provider = arg1
                if(typeof arg2 === 'string') {
                    args.push(arg2, ...otherArgs)
                }
            }
        } else {
            if(typeof arg0 === 'string') {
                executable = arg0
                if(typeof arg1 !== 'string') {
                    options = arg1
                } else {
                    args.push(arg1)
                }

                if(typeof arg2 === 'string') {
                    args.push(arg2, ...otherArgs)
                }
            } else if(arg0 !== undefined && 'executable' in arg0 && arg0.executable !== undefined) {
                provider = arg0
                if(typeof arg1 === 'string') {
                    args.push(arg1)
                    if(typeof arg2 === 'string') {
                        args.push(arg2, ...otherArgs)
                    }
                }
            }
        }

        // Getting the child process
        let childProcess: ChildProcess<PData, PMessage, IResult>
        if(provider !== undefined) {
            childProcess = provider instanceof Task && provider.state === TaskState.READY
                ? provider as ChildProcess<PData, PMessage, IResult> :
                new TaskContext.ChildProcess(provider)
        } else if(executable !== undefined) {
            childProcess = new TaskContext.ChildProcess(executable, options)
        } else {
            throw new TypeError(`No executable or ChildProcessProvider provided.`)
        }

        // Return the result
        return {childProcess, args, progressInheritance}
    }

    addChildProcess<PData extends {} = {}>(
        childProcess: ChildProcessProvider<PData, PMessage, IResult>
    ): ChildProcess<PData, PMessage, IResult>
    addChildProcess<PData extends {} = {}>(
        executable: string,
        options?: ChildProcessOptions<PData, PMessage, IResult>
    ): ChildProcess<PData, PMessage, IResult>
    addChildProcess<PData extends {} = {}>(
        progressInheritance: ProgressInheritance,
        childProcess: ChildProcessProvider<PData, PMessage, IResult>
    ): ChildProcess<PData, PMessage, IResult>
    addChildProcess<PData extends {} = {}>(
        progressInheritance: ProgressInheritance,
        executable: string,
        options?: ChildProcessOptions<PData, PMessage, IResult>
    ): ChildProcess<PData, PMessage, IResult>
    addChildProcess<PData extends {} = {}>(
        arg0: string|ChildProcessProvider<PData, PMessage, IResult>|ProgressInheritance,
        arg1?: string|ChildProcessProvider<PData, PMessage, IResult>|ChildProcessOptions<PData, PMessage, IResult>,
        arg2?: ChildProcessOptions<PData, PMessage, IResult>
    ): ChildProcess<PData, PMessage, IResult> {
        const {childProcess, progressInheritance} = this.getChildProcess(arg0, arg1, arg2)
        this.task.addSubTask(childProcess, progressInheritance)
        return childProcess
    }

    runChildProcess<PData extends {} = {}>(
        childProcess: ChildProcessProvider<PData, PMessage, IResult>,
        ...args: string[]
    ): ChildProcess<PData, PMessage, IResult>
    runChildProcess<PData extends {} = {}>(
        executable: string,
        options?: ChildProcessOptions<PData, PMessage, IResult>,
        ...args: string[]
    ): ChildProcess<PData, PMessage, IResult>
    runChildProcess<PData extends {} = {}>(
        executable: string,
        ...args: string[]
    ): ChildProcess<PData, PMessage, IResult>
    runChildProcess<PData extends {} = {}>(
        progressInheritance: ProgressInheritance,
        childProcess: ChildProcessProvider<PData, PMessage, IResult>,
        ...args: string[]
    ): ChildProcess<PData, PMessage, IResult>
    runChildProcess<PData extends {} = {}>(
        progressInheritance: ProgressInheritance,
        executable: string,
        options?: ChildProcessOptions<PData, PMessage, IResult>,
        ...args: string[]
    ): ChildProcess<PData, PMessage, IResult>
    runChildProcess<PData extends {} = {}>(
        progressInheritance: ProgressInheritance,
        executable: string,
        ...args: string[]
    ): ChildProcess<PData, PMessage, IResult>
    runChildProcess<PData extends {} = {}>(
        arg0: string|ChildProcessProvider<PData, PMessage, IResult>|ProgressInheritance,
        arg1?: string|ChildProcessProvider<PData, PMessage, IResult>|ChildProcessOptions<PData, PMessage, IResult>,
        arg2?: string|ChildProcessOptions<PData, PMessage, IResult>,
        ...otherArgs: string[]
    ): ChildProcess<PData, PMessage, IResult> {
        const {childProcess, progressInheritance, args} = this.getChildProcess(arg0, arg1, arg2, ...otherArgs)
        this.task.addSubTask(childProcess, progressInheritance).run(...args)
        return childProcess
    }
}
