import {
    ChildProcessOptions,
    ChildProcessProvider,
    TaskConstructorFunction,
    TaskDefinition,
    TaskInterruptionFlag,
    TaskState
} from './types'
import Callable from './utils/Callable'
import {Task} from './Task'
import {isTaskDefinition} from './utils'
import ChildProcess from './ChildProcess'

export default class Facade<FPMessage = any, FIResult = any> extends Callable<TaskConstructorFunction> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATIC CONSTANTS -------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    static readonly READY =                  TaskState.READY as const
    static readonly RUNNING =                TaskState.RUNNING as const
    static readonly SUCCEEDED =              TaskState.SUCCEEDED as const
    static readonly FAILED =                 TaskState.FAILED as const
    static readonly INTERRUPTED =            TaskState.INTERRUPTED as const
    static readonly INTERRUPT_DEFAULT =      TaskInterruptionFlag.DEFAULT as const
    static readonly INTERRUPT_USER =         TaskInterruptionFlag.USER as const
    static readonly INTERRUPT_EXIT =         TaskInterruptionFlag.EXIT as const
    static readonly INTERRUPT_TEST =         TaskInterruptionFlag.TEST as const
    static readonly INTERRUPT_FROM_PARENT =  TaskInterruptionFlag.FROM_PARENT as const
    static readonly INTERRUPT_FROM_CHILD =   TaskInterruptionFlag.FROM_CHILD as const
    static readonly INTERRUPT_FROM_FAILURE = TaskInterruptionFlag.FROM_FAILURE as const
    static readonly INTERRUPT_FORCE =        TaskInterruptionFlag.FORCE as const

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    constructor() {
        super('create')
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- CREATE/RUN TASK --------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    create<TResult = any, TArgs extends any[] = [], PMessage = FPMessage, IResult = FIResult>(
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult>
    create<TResult = any, TArgs extends any[] = [], PMessage = FPMessage, IResult = FIResult>(
        name: string,
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult>
    create<TResult = any, TArgs extends any[] = [], PMessage = FPMessage, IResult = FIResult>(
        arg0: string|TaskDefinition<TResult, TArgs, PMessage, IResult>,
        arg1?: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult>{
        if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg0)) { // TYPE 1
            return new Task<TResult, TArgs, PMessage, IResult>(arg0)
        } else if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg1)) { // TYPE 2
            return new Task<TResult, TArgs, PMessage, IResult>(arg0, arg1)
        } else {
            throw new TypeError(`No TaskDefinition provided.`)
        }
    }

    run<TResult = any, TArgs extends any[] = [], PMessage = FPMessage, IResult = FIResult>(
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>,
        ...args: TArgs
    ): Task<TResult, TArgs, PMessage, IResult>
    run<TResult = any, TArgs extends any[] = [], PMessage = FPMessage, IResult = FIResult>(
        name: string,
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>,
        ...args: TArgs
    ): Task<TResult, TArgs, PMessage, IResult>
    run<TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any>(
        arg0: string|TaskDefinition<TResult, TArgs, PMessage, IResult>,
        arg1?: TaskDefinition<TResult, TArgs, PMessage, IResult>|any,
        ...others: any[]
    ): Task<TResult, TArgs, PMessage, IResult> {
        if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg0)) { // TYPE 1
            return this.create(arg0).run(...[arg1, ...others] as TArgs)
        } else if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg1)) { // TYPE 2
            return this.create(arg0, arg1).run(...others as TArgs)
        } else {
            throw new TypeError(`No TaskDefinition provided.`)
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- CREATE/RUN CHILD PROCESS ------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    createChildProcess<PData extends {} = {}, PMessage = FPMessage, IResult = FIResult>(
        childProcess: ChildProcessProvider<PData, PMessage, IResult>
    ): ChildProcess<PData, PMessage, IResult>
    createChildProcess<PData extends {} = {}, PMessage = FPMessage, IResult = FIResult>(
        executable: string,
        options?: ChildProcessOptions<PData, PMessage, IResult>
    ): ChildProcess<PData, PMessage, IResult>
    createChildProcess<PData extends {} = {}, PMessage = FPMessage, IResult = FIResult>(
        arg0: string|ChildProcessProvider<PData, PMessage, IResult>,
        arg1?: ChildProcessOptions<PData, PMessage, IResult>
    ): ChildProcess<PData, PMessage, IResult> {
        if(typeof arg0 === 'string') {
            return new ChildProcess<PData, PMessage, IResult>(arg0, arg1)
        } else {
            return new ChildProcess<PData, PMessage, IResult>(arg0)
        }
    }

    runChildProcess<PData extends {} = {}, PMessage = FPMessage, IResult = FIResult>(
        childProcess: ChildProcessProvider<PData, PMessage, IResult>,
        ...args: string[]
    ): ChildProcess<PData, PMessage, IResult>
    runChildProcess<PData extends {} = {}, PMessage = FPMessage, IResult = FIResult>(
        executable: string,
        childProcess: ChildProcessOptions<PData, PMessage, IResult>,
        ...args: string[]
    ): ChildProcess<PData, PMessage, IResult>
    runChildProcess<PData extends {} = {}, PMessage = FPMessage, IResult = FIResult>(
        arg0: string|ChildProcessProvider<PData, PMessage, IResult>,
        arg1?: string|ChildProcessOptions<PData, PMessage, IResult>,
        ...args: string[]
    ): ChildProcess<PData, PMessage, IResult> {
        if(typeof arg0 === 'string' && typeof arg1 === 'object') {
            return this.createChildProcess(arg0, arg1).run(...args)
        } else if(typeof arg0 === 'object' && typeof arg1 === 'string') {
            return this.createChildProcess(arg0).run(arg1, ...args)
        } else if(typeof arg0 === 'object') {
            return this.createChildProcess(arg0).run()
        } else {
            throw new TypeError(`No ChildProcess provided.`)
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- FORWARD CONSTANTS ------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    get READY(): TaskState.READY { return Facade.READY }
    get RUNNING(): TaskState.RUNNING { return Facade.RUNNING }
    get SUCCEEDED(): TaskState.SUCCEEDED { return Facade.SUCCEEDED }
    get FAILED(): TaskState.FAILED { return Facade.FAILED }
    get INTERRUPTED(): TaskState.INTERRUPTED { return Facade.INTERRUPTED }
    get INTERRUPT_DEFAULT(): TaskInterruptionFlag.DEFAULT { return Facade.INTERRUPT_DEFAULT }
    get INTERRUPT_USER(): TaskInterruptionFlag.USER { return Facade.INTERRUPT_USER }
    get INTERRUPT_EXIT(): TaskInterruptionFlag.EXIT { return Facade.INTERRUPT_EXIT }
    get INTERRUPT_TEST(): TaskInterruptionFlag.TEST { return Facade.INTERRUPT_TEST }
    get INTERRUPT_FROM_PARENT(): TaskInterruptionFlag.FROM_PARENT { return Facade.INTERRUPT_FROM_PARENT }
    get INTERRUPT_FROM_CHILD(): TaskInterruptionFlag.FROM_CHILD { return Facade.INTERRUPT_FROM_CHILD }
    get INTERRUPT_FROM_FAILURE(): TaskInterruptionFlag.FROM_FAILURE { return Facade.INTERRUPT_FROM_FAILURE }
    get INTERRUPT_FORCE(): TaskInterruptionFlag.FORCE { return Facade.INTERRUPT_FORCE }
}
