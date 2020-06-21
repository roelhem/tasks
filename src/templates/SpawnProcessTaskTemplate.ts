import ChildProcessTaskTemplate, {
    Options as ChildProcessTaskOptions,
    ProcessOptions as ChildProcessTaskProcessOptions,
    ChildProcessTaskResult,
    ChildProcessTaskArgs,
} from './ChildProcessTaskTemplate'
import {ChildProcess, spawn, SpawnOptions} from 'child_process'
import {TaskInterruptionFlag} from '../types'
import TaskContext from '../utils/TaskContext'
import ChildProcessTaskContext from '../utils/ChildProcessTaskContext'

export interface SpawnProcessOptions extends ChildProcessTaskProcessOptions, SpawnOptions {

}

export interface Options<RData extends {} = {},
    POptions extends SpawnProcessOptions = SpawnProcessOptions,
    PMessage = string,
    IResult = any> extends ChildProcessTaskOptions<RData, POptions, PMessage, IResult> {

}

export interface SpawnProcessTaskConstructor<RData extends {} = {},
                                             POptions extends SpawnProcessOptions = SpawnProcessOptions,
                                             PMessage = string,
                                             IResult = any> {
    new (options?: Options<RData, POptions, PMessage, IResult>):
        SpawnProcessTaskTemplate<RData, POptions, PMessage, IResult>
}

export interface SpawnProcessTaskMethods<
    RData extends {} = {},
    POptions extends SpawnProcessOptions = SpawnProcessOptions,
    PMessage = string,
    IResult = any> {
    getInterruptionResult: (this: SpawnProcessTaskTemplate<RData, POptions, PMessage, IResult>,
                            context: ChildProcessTaskContext<RData, POptions, PMessage, IResult>,
                            interruptionFlag: TaskInterruptionFlag) => Promise<IResult>,
    prepareChildProcess?: (this: SpawnProcessTaskTemplate<RData, POptions, PMessage, IResult>,
                           context: TaskContext<ChildProcessTaskResult<RData>,
                                                ChildProcessTaskArgs<POptions>,
                                                PMessage,
                                                IResult>,
                           childProcess: ChildProcess,
                           args: string[],
                           options: SpawnProcessOptions) => Promise<ChildProcess>,
    getKillSignal?: (this: SpawnProcessTaskTemplate<RData, POptions, PMessage, IResult>,
                     context: ChildProcessTaskContext<RData, POptions, PMessage, IResult>,
                     interruptionFlag: TaskInterruptionFlag) => NodeJS.Signals | number
}

export default abstract class SpawnProcessTaskTemplate<
        RData extends {} = {},
        POptions extends SpawnProcessOptions = SpawnProcessOptions,
        PMessage = string,
        IResult = any
    > extends ChildProcessTaskTemplate<RData, POptions, PMessage, IResult> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATIC CONSTRUCTOR ------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    static create<
        RData extends {} = {},
        PMessage = string,
        >(
        command: string,
        defaultOptions?: SpawnProcessOptions,
        methods?: Partial<SpawnProcessTaskMethods<RData, SpawnProcessOptions, PMessage>>
    ): SpawnProcessTaskConstructor<RData, SpawnProcessOptions, PMessage>
    static create<
        RData extends {} = {},
        POptions extends SpawnProcessOptions = SpawnProcessOptions,
        PMessage = string,
        >(
        command: string,
        defaultOptions?: POptions,
        methods?: Partial<SpawnProcessTaskMethods<RData, POptions, PMessage>>
    ): SpawnProcessTaskConstructor<RData, POptions, PMessage>
    static create<
        RData extends {} = {},
        POptions extends SpawnProcessOptions = SpawnProcessOptions,
        PMessage = string,
        IResult = any>(
        command: string,
        defaultOptions: POptions,
        methods: SpawnProcessTaskMethods<RData, POptions, PMessage, IResult>
    ): SpawnProcessTaskConstructor<RData, POptions, PMessage, IResult>
    static create<
        RData extends {} = {},
        POptions extends SpawnProcessOptions = SpawnProcessOptions,
        PMessage = string,
        IResult = any>(
        command: string,
        defaultOptions?: SpawnProcessOptions|POptions,
        methods?: Partial<SpawnProcessTaskMethods<RData, SpawnProcessOptions, PMessage>>|SpawnProcessTaskMethods<RData, POptions, PMessage, IResult>
    ): SpawnProcessTaskConstructor<RData, SpawnProcessOptions, PMessage>
        |SpawnProcessTaskConstructor<RData, POptions, PMessage>
        |SpawnProcessTaskConstructor<RData, POptions, PMessage, IResult> {
        if(defaultOptions !== undefined
            && methods !== undefined
            && 'getInterruptionResult' in methods && typeof methods.getInterruptionResult === 'function') {
            return SpawnProcessTaskTemplate.createFull<RData, POptions, PMessage, IResult>(
                command,
                defaultOptions as POptions,
                methods as SpawnProcessTaskMethods<RData, POptions, PMessage, IResult>
            )
        } else if(defaultOptions !== undefined) {
            return SpawnProcessTaskTemplate.createFull<RData, POptions, PMessage>(
                command,
                defaultOptions as POptions,
                {
                    getInterruptionResult: async () => { return },
                    ...methods
                } as SpawnProcessTaskMethods<RData, POptions, PMessage>
            )
        } else {
            return SpawnProcessTaskTemplate.createFull<RData, SpawnProcessOptions, PMessage>(
                command,
                {},
                {
                    getInterruptionResult: async () => { return },
                    ...methods
                } as SpawnProcessTaskMethods<RData, SpawnProcessOptions, PMessage>
            )
        }
    }

    protected static createSimple(command: string,
                                  defaultOptions: SpawnProcessOptions = {},
                                  methods: Partial<SpawnProcessTaskMethods> = {}): SpawnProcessTaskConstructor {
        return SpawnProcessTaskTemplate.createFull(command, defaultOptions, {
            getInterruptionResult: async () => undefined,
            ...methods,
        })
    }

    protected static createFull<
        RData extends {} = {},
        POptions extends SpawnProcessOptions = SpawnProcessOptions,
        PMessage = string,
        IResult = any>(
            command: string,
            defaultOptions: POptions,
            methods: SpawnProcessTaskMethods<RData, POptions, PMessage, IResult>
    ): SpawnProcessTaskConstructor<RData, POptions, PMessage, IResult> {

        // Implement the abstract methods.
        const result = class extends SpawnProcessTaskTemplate<RData, POptions, PMessage, IResult> {
            constructor(options: Options<RData, POptions, PMessage, IResult> = {}) {
                super(command, options)
            }

            protected get defaultTaskOptions(): POptions {
                return defaultOptions
            }

            protected getInterruptionResult(context: ChildProcessTaskContext<RData, POptions, PMessage, IResult>,
                                            interruptionFlag: TaskInterruptionFlag): Promise<IResult> {
                return methods.getInterruptionResult.call(this, context, interruptionFlag)
            }

            protected async startChildProcess(context: TaskContext<ChildProcessTaskResult<RData>,
                                                                   ChildProcessTaskArgs<POptions>,
                                                                   PMessage,
                                                                   IResult>,
                                              args: string[],
                                              options: SpawnProcessOptions): Promise<ChildProcess> {
                if(methods.prepareChildProcess) {
                    const childProcess = await super.startChildProcess(context, args, options)
                    return await methods.prepareChildProcess.call(this, context, childProcess, args, options)
                } else {
                    return await super.startChildProcess(context, args, options)
                }
            }
        }

        // Implement the overwrite methods if they are set.
        if(methods.getKillSignal) { result.prototype.getKillSignal = methods.getKillSignal }

        // Return the result.
        return result
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected constructor(command: string, options: Options<RData, POptions, PMessage, IResult> = {}) {
        super(command, options)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- DEFAULT IMPLEMENTATION -------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected async startChildProcess(context: TaskContext<ChildProcessTaskResult<RData>,
                                                           ChildProcessTaskArgs<POptions>,
                                                           PMessage, IResult>,
                                      args: string[],
                                      options: SpawnProcessOptions): Promise<ChildProcess> {
        return spawn(this.command, args, options)
    }

}
