import TaskContext from './utils/TaskContext'
import {Task} from './Task'

// -------------------------------------------------------------------------------------------------------------- //
//   Task Definition                                                                                              //
// -------------------------------------------------------------------------------------------------------------- //


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
export interface ProgressInheritanceOptions {
    offset?: number
    end?: number
    scale?: number
    inheritMessages?: boolean
    inheritProgress: true
    events?: (string|symbol)[]
}

export type ProgressInheritance = ProgressInheritanceScale|ProgressInheritanceOffset
                                 |ProgressInheritanceRange|ProgressInheritanceOptions

// -------------------------------------------------------------------------------------------------------------- //
//   TaskState                                                                                                    //
// -------------------------------------------------------------------------------------------------------------- //

export enum TaskState {
    READY = 'READY',
    RUNNING = 'RUNNING',
    SUCCEEDED = 'SUCCEEDED',
    FAILED = 'FAILED',
    INTERRUPTED = 'INTERRUPTED',
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
