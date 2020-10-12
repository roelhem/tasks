import {
    ChildProcessOptions,
    ChildProcessProvider, CommandDescription,
    TaskDefinition,
    TaskInterruptionFlag,
    TaskState
} from './types'
import {Task} from './Task'
import {isTaskDefinition} from './utils'
import ChildProcess from './ChildProcess'
import Command from './Command'
import Callable from './utils/Callable'
import Factory from './factories/Factory'
import {ChildProcessFactory, CommandFactory, TaskFactory} from './factories'
import PreparedTask from './PreparedTask'

type Item<M = any, I = any> = Factory<any, any, M, I>

export default class Facade<M = any, I = any, FGArgs extends {} = {}> extends Callable<{
    <TResult = any, TArgs extends any[] = [], PMessage = M, IResult = I>(
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult>
    <TResult = any, TArgs extends any[] = [], PMessage = M, IResult = I>(
        name: string,
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult>
}> implements Map<string, Item<M, I>> {

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

    readonly [Symbol.toStringTag]: string = 'TaskFacade'
    protected factories: Map<string, Item<M, I>>

    constructor() {
        super('create')
        this.factories = new Map()
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- CREATE/RUN TASK --------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    create<TResult = any, TArgs extends any[] = any[], PMessage = M, IResult = I>(
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult>
    create<TResult = any, TArgs extends any[] = any[], PMessage = M, IResult = I>(
        name: string,
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult>
    create<TResult = any, TArgs extends any[] = any[]>(
        key: string
    ): Task<TResult, TArgs, M, I>
    create<TResult = any, TArgs extends any[] = any[], PMessage = M, IResult = I>(
        arg0: string|TaskDefinition<TResult, TArgs, PMessage, IResult>,
        arg1?: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult>|Task<TResult, TArgs, M, I>{
        if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg0)) { // TYPE 1
            return new Task<TResult, TArgs, PMessage, IResult>(arg0)
        } else if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg1)) { // TYPE 2
            return new Task<TResult, TArgs, PMessage, IResult>(arg0, arg1)
        } else {
            const factory = this.factories.get(arg0)
            if(!factory) {
                throw new Error(`No task with key '${arg0}' defined.`)
            }
            return factory.create()
        }
    }

    define<TResult = any, TArgs extends any[] = any[]>(
        key: string,
        taskDefinition: TaskDefinition<TResult, TArgs, M, I>
    ): TaskFactory<TResult, TArgs, M, I> {
        const result = new TaskFactory<TResult, TArgs, M, I>(key, taskDefinition)
        this.factories.set(key, result)
        return result
    }

    run<TResult = any, TArgs extends any[] = any[], PMessage = M, IResult = I>(
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>,
        ...args: TArgs
    ): Task<TResult, TArgs, PMessage, IResult>
    run<TResult = any, TArgs extends any[] = any[], PMessage = M, IResult = I>(
        name: string,
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>,
        ...args: TArgs
    ): Task<TResult, TArgs, PMessage, IResult>
    run<TResult = void, TArgs extends any[] = any[]>(
        key: string,
        ...args: TArgs
    ): Task<TResult, TArgs, M, I>
    run<TResult = void, TArgs extends any[] = any[], PMessage = string, IResult = any>(
        arg0: string|TaskDefinition<TResult, TArgs, PMessage, IResult>,
        arg1?: TaskDefinition<TResult, TArgs, PMessage, IResult>|any,
        ...others: any[]
    ): Task<TResult, TArgs, PMessage, IResult>|Task<TResult, TArgs, M, I> {
        if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg0)) { // TYPE 1
            return this.create(arg0).run(...[arg1, ...others] as TArgs)
        } else if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg1)) { // TYPE 2
            return this.create(arg0, arg1).run(...others as TArgs)
        } else {
            const factory = this.factories.get(arg0)
            if(!factory) {
                throw new Error(`No task with key '${arg0}' defined.`)
            }
            return factory.run(...[arg1, ...others] as TArgs)
        }
    }

    prepare<TResult = any, TArgs extends any[] = any[], PMessage = M, IResult = I>(
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>,
        ...args: TArgs
    ): PreparedTask<TResult, TArgs, PMessage, IResult>
    prepare<TResult = any, TArgs extends any[] = any[], PMessage = M, IResult = I>(
        name: string,
        task: TaskDefinition<TResult, TArgs, PMessage, IResult>,
        ...args: TArgs
    ): PreparedTask<TResult, TArgs, PMessage, IResult>
    prepare<TResult = void, TArgs extends any[] = any[]>(
        key: string,
        ...args: TArgs
    ): PreparedTask<TResult, TArgs, M, I>
    prepare<TResult = void, TArgs extends any[] = any[], PMessage = string, IResult = any>(
        arg0: string|TaskDefinition<TResult, TArgs, PMessage, IResult>,
        arg1?: TaskDefinition<TResult, TArgs, PMessage, IResult>|any,
        ...others: any[]
    ): PreparedTask<TResult, TArgs, PMessage, IResult>|PreparedTask<TResult, TArgs, M, I> {
        if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg0)) { // TYPE 1
            return this.create(arg0).prepare(...[arg1, ...others] as TArgs)
        } else if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg1)) { // TYPE 2
            return this.create(arg0, arg1).prepare(...others as TArgs)
        } else {
            const factory = this.factories.get(arg0)
            if(!factory) {
                throw new Error(`No task with key '${arg0}' defined.`)
            }
            return factory.prepare(...[arg1, ...others] as TArgs)
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- CREATE/RUN CHILD PROCESS ------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    createChildProcess<PData extends {} = {}, PMessage = M, IResult = I>(
        childProcess: ChildProcessProvider<PData, PMessage, IResult>
    ): ChildProcess<PData, PMessage, IResult>
    createChildProcess<PData extends {} = {}, PMessage = M, IResult = I>(
        executable: string,
        options?: ChildProcessOptions<PData, PMessage, IResult>
    ): ChildProcess<PData, PMessage, IResult>
    createChildProcess<PData extends {} = {}, PMessage = M, IResult = I>(
        arg0: string|ChildProcessProvider<PData, PMessage, IResult>,
        arg1?: ChildProcessOptions<PData, PMessage, IResult>
    ): ChildProcess<PData, PMessage, IResult> {
        if(typeof arg0 === 'string') {
            return new ChildProcess<PData, PMessage, IResult>(arg0, arg1)
        } else {
            return new ChildProcess<PData, PMessage, IResult>(arg0)
        }
    }

    defineChildProcess<PData extends {} = {}>(
        key: string,
        childProcess: ChildProcessProvider<PData, M, I>
    ): ChildProcessFactory<PData, M, I> {
        const res = new ChildProcessFactory(key, childProcess)
        this.factories.set(key, res)
        return res
    }

    runChildProcess<PData extends {} = {}, PMessage = M, IResult = I>(
        childProcess: ChildProcessProvider<PData, PMessage, IResult>,
        ...args: string[]
    ): ChildProcess<PData, PMessage, IResult>
    runChildProcess<PData extends {} = {}, PMessage = M, IResult = I>(
        executable: string,
        childProcess: ChildProcessOptions<PData, PMessage, IResult>,
        ...args: string[]
    ): ChildProcess<PData, PMessage, IResult>
    runChildProcess<PData extends {} = {}, PMessage = M, IResult = I>(
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
    // ---- CREATE/ADD COMMANDS ----------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    createCommand<CResult=any, CArgs extends {}={}, GArgs extends {}=FGArgs, PMessage=M, IResult=I> (
        description: CommandDescription<CResult, CArgs, GArgs, PMessage, IResult>
    ): Command<CResult, CArgs, GArgs, PMessage, IResult>
    createCommand<CResult=any, CArgs extends {}={}, GArgs extends {}=FGArgs, PMessage=M, IResult=I> (
        command: string,
        description: CommandDescription<CResult, CArgs, GArgs, PMessage, IResult>
    ): Command<CResult, CArgs, GArgs, PMessage, IResult>
    createCommand<CResult=any, CArgs extends {}={}, GArgs extends {}=FGArgs, PMessage=M, IResult=I> (
        arg0: string| CommandDescription<CResult, CArgs, GArgs, PMessage, IResult>,
        arg1?: CommandDescription<CResult, CArgs, GArgs, PMessage, IResult>
    ): Command<CResult, CArgs, GArgs, PMessage, IResult> {
        if(typeof arg0 === 'string' && typeof arg1 === 'object') {
            return new Command<CResult, CArgs, GArgs, PMessage, IResult>(arg0, arg1)
        } else if(typeof arg0 === 'object') {
            return new Command<CResult, CArgs, GArgs, PMessage, IResult>(arg0)
        } else {
            throw new TypeError(`No CommandDescription provided.`)
        }
    }

    defineCommand<CResult=any, CArgs extends {}={}, GArgs extends {}=FGArgs> (
        key: string,
        description: CommandDescription<CResult, CArgs, GArgs, M, I>
    ): CommandFactory<CResult, CArgs, GArgs, M, I> {
        const res = new CommandFactory(key, description)
        this.factories.set(key, res)
        return res
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

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENT: Map<string, Item<M, I>> -------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    has(key: string): boolean {
        return this.factories.has(key)
    }

    delete(key: string): boolean {
        return this.factories.delete(key)
    }

    clear(): void {
        return this.factories.clear()
    }

    set(key: string, task: Item<M, I>): this {
        this.factories.set(key, task as any)
        return this
    }

    get size(): number {
        return this.factories.size
    }

    [Symbol.iterator](): IterableIterator<[string, Item<M, I>]> {
        return this.factories[Symbol.iterator]()
    }

    entries(): IterableIterator<[string, Item<M, I>]> {
        return this.factories.entries()
    }

    forEach(callback: (value: Item<M, I>, key: string, facade: this,) => void): void {
        this.factories.forEach((value, key) => callback(value, key, this))
    }

    get(key: string): Item<M, I> | undefined {
        return this.factories.get(key)
    }

    keys(): IterableIterator<string> {
        return this.factories.keys()
    }

    values(): IterableIterator<Item<M, I>> {
        return this.factories.values()
    }
}
