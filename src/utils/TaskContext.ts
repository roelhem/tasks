import {CleanupTask, SubTask, Task} from '../Task'
import {
    CleanupTaskDefinition,
    ProgressInheritance,
    ProgressInheritanceScale,
    TaskDefinition,
    TaskInterrupter
} from '../types'
import {isProgressInheritance, isTaskDefinition} from './checkers'

export default class TaskContext<TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any> {

    static empty<TResult = void,
                 TArgs extends any[] = [],
                 PMessage = string,
                 IResult = any>(...args: TArgs): TaskContext<TResult, TArgs, PMessage, IResult> {
        const emptyTask = new Task<TResult, TArgs, PMessage, IResult>(() => { return })
        return new TaskContext<TResult, TArgs, PMessage, IResult>(emptyTask, args)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- GETTERS ----------------------------------------------------------------------------------------------- //
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
    reject(reason: any): void {
        this.task.reject(reason)
    }

    /**
     * Method that should be called from the task when the task has found it's result.
     *
     * @param result The result of the task
     */
    resolve(result: TResult): void {
        this.task.resolve(result)
    }

    /**
     * Method that should be called when the task is interrupted.
     *
     * @param interruptResult A description of the point where the task was interrupted.
     */
    interrupt(interruptResult: IResult): void {
        this.task.softInterrupt(interruptResult)
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
    setInterrupter(interrupter: TaskInterrupter<IResult>): void {
        this.task.setInterrupter(interrupter)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- PROGRESS CONTROL -------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    setProgressTotal(total: number, message?: PMessage): void {
        this.task.changeProgress(undefined, total, message)
    }
    setProgressMessage(message: PMessage): void {
        this.task.changeProgress(undefined, undefined, message)
    }
    setProgress(progress: number, total?: number, message?: PMessage): void {
        this.task.changeProgress(progress, total, message)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- SUB TASKS --------------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    addSubTask<SubTResult = void, SubTArgs extends any[] = []>(
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>
    ): SubTask<SubTResult, SubTArgs, PMessage, IResult>
    addSubTask<SubTResult = void, SubTArgs extends any[] = []>(
        name: string,
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>
    ): SubTask<SubTResult, SubTArgs, PMessage, IResult>
    addSubTask<SubTResult = void, SubTArgs extends any[] = []>(
        progressInheritance: ProgressInheritance,
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>
    ): SubTask<SubTResult, SubTArgs, PMessage, IResult>
    addSubTask<SubTResult = void, SubTArgs extends any[] = []>(
        progressInheritance: ProgressInheritance,
        name: string,
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>
    ): SubTask<SubTResult, SubTArgs, PMessage, IResult>
    addSubTask<SubTResult, SubTArgs extends any[]>(
        arg0: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|string|ProgressInheritance,
        arg1?: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|string,
        arg2?: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>
    ): SubTask<SubTResult, SubTArgs, PMessage, IResult> {
        if(isTaskDefinition(arg0)) {
            return this.task.addSubTask<SubTResult, SubTArgs>(arg0)
        } else if(isTaskDefinition(arg1)) {
            if(isProgressInheritance(arg0)) {
                return this.task.addSubTask<SubTResult, SubTArgs>(arg1, arg0)
            } else {
                return this.task.addSubTask<SubTResult, SubTArgs>(arg1, undefined, arg0 as string)
            }
        } else if(isTaskDefinition(arg2)) {
            return this.task.addSubTask<SubTResult, SubTArgs>(arg2, arg0 as ProgressInheritance, arg1 as string)
        }
        throw new TypeError(`Invalid TaskContext.addSubTask(...) call.`)
    }

    runSubTask<SubTResult = void, SubTArgs extends any[] = []>(
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>,
        ...args: SubTArgs
    ): SubTask<SubTResult, SubTArgs, PMessage, IResult>

    runSubTask<SubTResult = void, SubTArgs extends any[] = []>(
        name: string,
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>,
        ...args: SubTArgs
    ): SubTask<SubTResult, SubTArgs, PMessage, IResult>

    runSubTask<SubTResult = void, SubTArgs extends any[] = []>(
        progressInheritance: ProgressInheritance,
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>,
        ...args: SubTArgs
    ): SubTask<SubTResult, SubTArgs, PMessage, IResult>

    runSubTask<SubTResult = void, SubTArgs extends any[] = []>(
        progressInheritance: ProgressInheritance,
        name: string,
        task: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>,
        ...args: SubTArgs
    ): SubTask<SubTResult, SubTArgs, PMessage, IResult>
    runSubTask<SubTResult, SubTArgs extends any[]>(
        arg0: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|string|ProgressInheritance,
        arg1?: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|string|any,
        arg2?: TaskDefinition<SubTResult, SubTArgs, PMessage, IResult>|any,
        ...args: any[]
    ): SubTask<SubTResult, SubTArgs, PMessage, IResult> {
        // Getting the right task.
        if(isTaskDefinition(arg0)) { // TYPE 1
            return this.addSubTask<SubTResult, SubTArgs>(arg0)
                .run(...[arg1, arg2, ...args] as SubTArgs)
        } else if(isTaskDefinition(arg1)) { // TYPE 1, 2
            return this.addSubTask<SubTResult, SubTArgs>(arg0 as string, arg1)
                .run(...[arg2, ...args] as SubTArgs)
        } else if(isTaskDefinition(arg2)) { // TYPE 3
            return this.addSubTask<SubTResult, SubTArgs>(arg0 as ProgressInheritance, arg1 as string, arg2)
                .run(...args as SubTArgs)
        } else {
            throw new TypeError(`Invalid TaskContext.runSubTask(...) call.`)
        }
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

    addCleanupTask(
        progressInheritanceScale: ProgressInheritanceScale,
        cleanupTask: CleanupTaskDefinition<TResult, TArgs, IResult>
    ): CleanupTask<TResult, TArgs, IResult>

    addCleanupTask(
        progressInheritanceScale: ProgressInheritanceScale,
        name: string,
        cleanupTask: CleanupTaskDefinition<TResult, TArgs, IResult>
    ): CleanupTask<TResult, TArgs, IResult>
    addCleanupTask (
        arg0: CleanupTaskDefinition<TResult, TArgs, IResult>|string|ProgressInheritanceScale,
        arg1?: CleanupTaskDefinition<TResult, TArgs, IResult>|string,
        arg2?: CleanupTaskDefinition<TResult, TArgs, IResult>
    ): CleanupTask<TResult, TArgs, IResult> {
        if(isTaskDefinition(arg0)) {
            return this.task.addCleanupTask(arg0)
        } else if(isTaskDefinition(arg1)) {
            if(isProgressInheritance(arg0)) {
                return this.task.addCleanupTask(arg1, arg0)
            } else {
                return this.task.addCleanupTask(arg1, undefined, arg0 as string)
            }
        } else if(isTaskDefinition(arg2)) {
            return this.task.addCleanupTask(arg2, arg0 as ProgressInheritanceScale, arg1 as string)
        }
        throw new TypeError(`Invalid TaskContext.addCleanupTask(...) call.`)
    }

}
