// -------------------------------------------------------------------------------------------------------------- //
//   Task Definition                                                                                              //
// -------------------------------------------------------------------------------------------------------------- //

import {CleanupTask, SubTask, Task} from './Task'

export type TaskFunction<TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any> =
    (context: TaskContext<TResult, TArgs, PMessage>, ...args: TArgs) => Promise<TResult>|TResult|void

export interface TaskProvider<TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any> {
    task: TaskFunction<TResult, TArgs, PMessage>
    taskName?: string
}

export interface NamedTaskProvider<TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any>
    extends TaskProvider<TResult, TArgs, PMessage, IResult> {
    taskName: string
}

export type TaskDefinition<TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any> =
    TaskFunction<TResult, TArgs, PMessage>|TaskProvider<TResult, TArgs, PMessage>

// -------------------------------------------------------------------------------------------------------------- //
//   Special Kind Of Tasks                                                                                        //
// -------------------------------------------------------------------------------------------------------------- //

export type CleanupProgressMessage = {}
export type CleanupInterruptionResult = {}

export type CleanupTaskDefinition<TResult, TArgs, IResult>
    = TaskDefinition<void,
        [any|undefined, IResult|undefined, TResult|undefined],
        CleanupProgressMessage,
        CleanupInterruptionResult>

// -------------------------------------------------------------------------------------------------------------- //
//   Task Context                                                                                                 //
// -------------------------------------------------------------------------------------------------------------- //

/**
 * An object that will be passed to a [[TaskFunction]] which is used to define the behavior of the task.
 */
export interface TaskContext<TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- GETTERS ----------------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * The arguments with whom this task was called.
     */
    readonly args: TArgs

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- TASK TERMINATORS -------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Method that should be called from the task when an error occurred during the execution of the task.
     *
     * @param reason The reason for the error. Is an `Error`-object in most cases.
     */
    reject(reason: any): void

    /**
     * Method that should be called from the task when the task has found it's result.
     *
     * @param result The result of the task
     */
    resolve(result: TResult): void

    /**
     * Method that should be called when the task is interrupted.
     *
     * @param interruptResult A description of the point where the task was interrupted.
     */
    interrupt(interruptResult: IResult): void

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INTERRUPTION CONTROL ---------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Sets the interrupter function. This function will be called when the task is interrupted from outside of the
     * task definition.
     *
     * @param interrupter The interrupter method.
     */
    setInterrupter(interrupter: TaskInterrupter<IResult>): void

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- PROGRESS CONTROL -------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    setProgressTotal(total: number): void
    setProgressMessage(message: PMessage): void
    setProgress(progress: number, total?: number, message?: PMessage): void

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
}


// -------------------------------------------------------------------------------------------------------------- //
//   Task Interrupter                                                                                             //
// -------------------------------------------------------------------------------------------------------------- //

export enum TaskInterruptionFlag {
    DEFAULT      = 0b00000000,
    USER         = 0b00000001,
    EXIT         = 0b00000010,
    TEST         = 0b00000100,
    FROM_PARENT  = 0b00010000,
    FROM_CHILD   = 0b00100000,
    FROM_FAILURE = 0b01000000,
}

export type TaskInterrupter<IResult = any> = (flag: TaskInterruptionFlag) => Promise<IResult>|IResult

// -------------------------------------------------------------------------------------------------------------- //
//   Progress Inheritance                                                                                         //
// -------------------------------------------------------------------------------------------------------------- //

export type ProgressInheritanceScale = number
export type ProgressInheritanceOffset = [number]
export type ProgressInheritanceRange = [number, number]

export type ProgressInheritance = ProgressInheritanceScale|ProgressInheritanceOffset|ProgressInheritanceRange

// -------------------------------------------------------------------------------------------------------------- //
//   TaskState                                                                                                    //
// -------------------------------------------------------------------------------------------------------------- //

export enum TaskState {
    READY = 'READY',
    RUNNING = 'RUNNING',
    SUCCEEDED = 'SUCCEEDED',
    FAILED = 'FAILED',
    INTERRUPTED = 'INTERRUPTED'
}

// -------------------------------------------------------------------------------------------------------------- //
//   Facade interfaces                                                                                            //
// -------------------------------------------------------------------------------------------------------------- //

export interface TaskConstructorFunction {
    <TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any>(
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult>
    <TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any>(
        name: string,
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult>
}

export interface TaskRunnerFunction {
    <TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any>(
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>,
        ...args: TArgs
    ): Task<TResult, TArgs, PMessage, IResult>
    <TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any>(
        name: string,
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>,
        ...args: TArgs
    ): Task<TResult, TArgs, PMessage, IResult>
}

export interface TaskFacade extends TaskConstructorFunction {
    create: TaskConstructorFunction
    run: TaskRunnerFunction
    readonly READY: TaskState.READY
    readonly RUNNING: TaskState.RUNNING
    readonly SUCCEEDED: TaskState.SUCCEEDED
    readonly FAILED: TaskState.FAILED
    readonly INTERRUPTED: TaskState.INTERRUPTED
    readonly INTERRUPT_DEFAULT: TaskInterruptionFlag.DEFAULT
    readonly INTERRUPT_USER: TaskInterruptionFlag.USER
    readonly INTERRUPT_EXIT: TaskInterruptionFlag.EXIT
    readonly INTERRUPT_TEST: TaskInterruptionFlag.TEST
    readonly INTERRUPT_FROM_PARENT: TaskInterruptionFlag.FROM_PARENT
    readonly INTERRUPT_FROM_CHILD: TaskInterruptionFlag.FROM_CHILD
    readonly INTERRUPT_FROM_FAILURE: TaskInterruptionFlag.FROM_FAILURE
}
