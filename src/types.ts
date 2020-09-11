import TaskContext from './utils/TaskContext'
import {Task} from './Task'
import {Arguments, Argv, CommandBuilder, Options as ArgOptions} from 'yargs'
import {ChildProcess as BaseChildProcess, CommonOptions} from 'child_process'
import ChildProcess from './ChildProcess'
import ChildProcessContext from './utils/ChildProcessContext'
import ProcessEnvFilter from './utils/ProcessEnvFilter'

// -------------------------------------------------------------------------------------------------------------- //
//   Task Definition                                                                                              //
// -------------------------------------------------------------------------------------------------------------- //

/**
 * Extra options for the construction of a [[Task]].
 */
export interface TaskOptions<TResult = any, TArgs extends any[] = [], PMessage = any, IResult = any> {
    /**
     * A function that will be called directly after the [[Task]] is constructed.
     *
     * It can be used to set event-listeners on the task.
     *
     * @param task The [[Task]] that was constructed.
     */
    taskSetup?(task: Task<TResult, TArgs, PMessage, IResult>): void
    /**
     * The name of the [[Task]]. Is mainly used for debug-purposes.
     */
    taskName?: string
}

/**
 * A function that can be used to construct a new [[Task]].
 */
export interface TaskFunction<TResult = any, TArgs extends any[] = [], PMessage = any, IResult = any>
    extends TaskOptions<TResult, TArgs, PMessage, IResult> {
    /**
     * The function that defines the behavior of the [[Task]].
     *
     * @param context: The [[TaskContext]] of the [[Task]], used to control the execution of the task.
     * @param args: The input arguments of the [[Task]] (which were passed when `task.run` is called).
     */
    (context: TaskContext<TResult, TArgs, PMessage, IResult>, ...args: TArgs): Promise<TResult>|TResult|void
}


export interface TaskProvider<TResult = any, TArgs extends any[] = [], PMessage = any, IResult = any>
    extends TaskOptions<TResult, TArgs, PMessage, IResult> {
    /**
     * The method that defines the behavior of the [[Task]].
     *
     * @param context: The [[TaskContext]] of the [[Task]], used to control the execution of the task.
     * @param args: The input arguments of the [[Task]] (which were passed when `task.run` is called).
     */
    task(context: TaskContext<TResult, TArgs, PMessage, IResult>, ...args: TArgs): Promise<TResult>|TResult|void
}

export interface NamedTaskProvider<TResult = any, TArgs extends any[] = [], PMessage = any, IResult = any>
    extends TaskProvider<TResult, TArgs, PMessage, IResult> {
    taskName: string
}

export type TaskDefinition<TResult = any, TArgs extends any[] = [], PMessage = any, IResult = any> =
    TaskFunction<TResult, TArgs, PMessage, IResult>|TaskProvider<TResult, TArgs, PMessage, IResult>

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
    FORCE        = 0b10000000,
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
//   Task Events                                                                                                  //
// -------------------------------------------------------------------------------------------------------------- //

export interface TaskEvents<TResult = any, TArgs extends any[] = [], PMessage = any, IResult = any> {
    started(...args: TArgs): void
    succeeded(result: TResult): void
    failed(reason: any): void
    interrupted(interruptionResult: IResult): void
    finished(state: TaskState): void
    stateChange(state: TaskState,
                previousState: TaskState): void
    newCustomEvent(event: string|symbol): void
    progressUpdate(progress: number,
                   progressTotal?: number,
                   progressMessage?: PMessage): void
    subProgressUpdate(progress: number,
                      progressTotal?: number,
                      progressMessage?: PMessage,
                      subTask?: Task<unknown, unknown[], PMessage, IResult>): void
    cleanupStarted(...args: [any|undefined, IResult|undefined, TResult|undefined]): void
    cleanupSucceeded(): void
    cleanupFailed(reason: any): void
    cleanupInterrupted(interruptionResult: CleanupInterruptionResult): void
    cleanupFinished(state: TaskState): void
    cleanupStateChange(state: TaskState,
                       previousState: TaskState): void
    cleanupProgressUpdate(progress: number,
                          progressTotal?: number,
                          progressMessage?: CleanupProgressMessage): void
}

// -------------------------------------------------------------------------------------------------------------- //
//   Facade interfaces                                                                                            //
// -------------------------------------------------------------------------------------------------------------- //

export interface TaskConstructorFunction {
    <TResult = any, TArgs extends any[] = [], PMessage = any, IResult = any>(
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult>
    <TResult = any, TArgs extends any[] = [], PMessage = any, IResult = any>(
        name: string,
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult>
}

// -------------------------------------------------------------------------------------------------------------- //
//   Command Options                                                                                              //
// -------------------------------------------------------------------------------------------------------------- //

/**
 * Options to create a [[Command]].
 *
 * See: [yarg](https://yargs.js.org)
 */
export interface CommandOptions<CResult = any, CArgs extends {} = {}, GArgs extends {} = {}> {
    command?: string
    aliases?: string | readonly string[]
    build?: CommandBuilder<GArgs, CArgs & GArgs> | { [key: string]: ArgOptions }
    description?: string
    hidden?: boolean
    skipCleanup?: boolean
    exit?: CommandExitOptions<CResult>
}

// -------------------------------------------------------------------------------------------------------------- //
//   Command Description                                                                                          //
// -------------------------------------------------------------------------------------------------------------- //

/**
 * A [[TaskProvider]] that also contain the [[CommandOptions]].
 */
export interface CommandProvider<CResult = any,
    CArgs extends {} = {},
    GArgs extends {} = {},
    PMessage = any,
    IResult = any>
extends TaskProvider<CResult, [Arguments<CArgs & GArgs>], PMessage, IResult>, CommandOptions<CResult, CArgs, GArgs> {}

/**
 * A [[TaskFunction]] that can also provide the [[CommandOptions]].
 */
export interface CommandFunction<CResult = any,
    CArgs extends {} = {},
    GArgs extends {} = {},
    PMessage = any,
    IResult = any>
extends TaskFunction<CResult, [Arguments<CArgs & GArgs>], PMessage, IResult>, CommandOptions<CResult, CArgs, GArgs> {}

/**
 * A [[TaskDescription]] that can also provide the [[CommandOptions]].
 */
export type CommandDescription<CResult = any,
    CArgs extends {} = {},
    GArgs extends {} = {},
    PMessage = any,
    IResult = any> =
    CommandProvider<CResult, CArgs, GArgs, PMessage, IResult>
    | CommandFunction<CResult, CArgs, GArgs, PMessage, IResult>

// -------------------------------------------------------------------------------------------------------------- //
//   Command Exit Behavior                                                                                        //
// -------------------------------------------------------------------------------------------------------------- //

/**
 * The way that an of a [[Command]].
 */
export type CommandExitState = 'succeeded' | 'interrupted' | 'failed' | 'cleanupInterrupted' | 'cleanupFailed'

/**
 * The configuration to determine how a [[Command]] should exit.
 *
 * Each key is one is a [[CommandExitState]] and the value is one of the following types:
 *  - `true`: The process should exit with the default exit-code (`0` for `succeeded`, `1` otherwise.)
 *  - `false`: The process should not exit.
 *  - `number`: The process should exit with the provided exit-code.
 */
export type CommandExitConfig = {
    [K in CommandExitState]: number | boolean
}

/**
 * A function that will be called when a [[Command]] wants to exit.
 */
export type CommandExitHandler<CResult = any> = (
    error: Error & { exitCode?: any } | undefined,
    state: CommandExitState,
    result?: CResult,
) => void

/**
 * The options to determine how a [[Command]] should exit.
 *
 * The exit-behaviour will be influenced in the following way:
 *  - `true`: The process should exit with the default exit-codes (`0` for `succeeded`, `1` otherwise.)
 *  - `false`: The process should not exit.
 *  - [[CommandExitConfig]]: The configuration of the exit-behaviour per [[CommandExitState]]. Unset values will
 *    default to `true`.
 *  - [[CommandExitHandler]]: A function that handles the custom exit.
 */
export type CommandExitOptions<CResult = any> = boolean | Partial<CommandExitConfig> | CommandExitHandler<CResult>

// -------------------------------------------------------------------------------------------------------------- //
//   ChildProcess Command                                                                                         //
// -------------------------------------------------------------------------------------------------------------- //

/**
 * The type of a [[ChildProcess]]. Determines how the child-process will be executed.
 *
 * This will determine which function will be called to start the child-process. The values will have the following
 * behaviour:
 *  - `exec`: Uses `child_process.exec`. (See: [Node.js documentation](https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback))
 *  - `execFile`: Uses `child_process.execFile`. (See: [Node.js documentation](https://nodejs.org/api/child_process.html#child_process_child_process_execfile_file_args_options_callback))
 *  - `fork`: Uses `child_process.fork`. (See: [Node.js documentation](https://nodejs.org/api/child_process.html#child_process_child_process_fork_modulepath_args_options))
 *  - `spawn`: Uses `child_process.spawn`. (See: [Node.js documentation](https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options))
 */
export type ChildProcessType = 'exec'|'execFile'|'fork'|'spawn'

export type ChildProcessSetup<PData extends {} = {}, PMessage = any, IResult = any> = (
    context: ChildProcessContext<PData, PMessage, IResult>,
    ...args: string[]
) => Promise<{
    prependArgs?: string[]
    appendArgs?: string[]
    env?: NodeJS.ProcessEnv
}|void>

/**
 * The options used to create a new [[ChildProcess]].
 */
export interface ChildProcessOptions<PData extends {} = {}, PMessage = any, IResult = any>
    extends CommonOptions, TaskOptions<ChildProcessResult<PData>, string[], PMessage, IResult> {
    childProcessType?: ChildProcessType
    prependArgs?: string[]
    appendArgs?: string[]
    killSignal?: NodeJS.Signals | number
    interruptSignal?: NodeJS.Signals | number
    maxBuffer?: number
    shell?: string|boolean
    detached?: boolean
    silent?: boolean
    processName?: string
    endEvent?: 'exit'|'close'
    nodeExecPath?: string
    nodeExecArgv?: string[]
    inheritEnv?: ProcessEnvFilterSettings|ProcessEnvFilter
    encoding?: BufferEncoding
    argv0?: string
    allowNonZeroExitCode?: boolean
    childProcessSetup?: ChildProcessSetup<PData, PMessage, IResult>
    childProcessTimeout?: number|null
    windowsVerbatimArguments?: boolean
    lineHandlers?: Iterable<LineHandler<PData, PMessage, IResult>>
}

export interface ChildProcessProvider<PData extends {} = {}, PMessage = any, IResult = any>
    extends ChildProcessOptions<PData, PMessage, IResult> {
    executable: string
}

export type ChildProcessDescription<PData extends {} = {}, PMessage = any, IResult = any> =
    ChildProcessProvider<PData, PMessage, IResult>

export interface ChildProcessResult<PData extends {} = {}> {
    childProcessType: ChildProcessType
    data: Partial<PData>
    childProcess: BaseChildProcess|null
    exitSignal: string|null
    exitCode: number|null
    stdout: string|null
    stderr: string|null
}

export type ChildProcessLineHandler<PData extends {} = {}, PMessage = any, IResult = any> = (
    this: ChildProcess<PData, PMessage, IResult>
) => void

export interface ChildProcessEvents extends TaskEvents {
    close(exitCode: number, exitSignal: NodeJS.Signals): void
    disconnect(): void
    error(error: Error): void
    exit(exitCode: number|null, exitSignal: NodeJS.Signals|null): void
    message(message: any, sendHandle: any): void
    line(line: string, stream: ChildProcessReadableStream): void
}

export type ChildProcessWritableStream = 'stdin'
export type ChildProcessReadableStream = 'stdout'|'stderr'
export type ChildProcessStream = ChildProcessWritableStream|ChildProcessReadableStream

// -------------------------------------------------------------------------------------------------------------- //
//   ProcessEnv                                                                                                   //
// -------------------------------------------------------------------------------------------------------------- //

/**
 * Describes a filter for environment variables.
 */
export type ProcessEnvFilterSettings = boolean|string|RegExp|((key: string, value: string|undefined) => boolean)
    |ProcessEnvFilterSettings[]

// -------------------------------------------------------------------------------------------------------------- //
//   LineReader                                                                                                   //
// -------------------------------------------------------------------------------------------------------------- //

/**
 * A function to handle an output-line of a [[ChildProcess]].
 */
export type LineHandler<PData extends {} = {}, PMessage = any, IResult = any> = (
    this: ChildProcess<PData, PMessage, IResult>,
    context: ChildProcessContext<PData, PMessage, IResult>,
    stream: ChildProcessReadableStream,
    line: string
) => void
