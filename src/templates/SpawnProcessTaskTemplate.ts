import ChildProcessTaskTemplate, {
    ChildProcessReadableStream,
    ChildProcessTaskContext,
    Options as ChildProcessTaskOptions,
    ProcessOptions as ChildProcessTaskProcessOptions,
    Result as ChildProcessTaskResult, TaskArgs,
    TaskArgs as ChildProcessTaskArgs,
} from './ChildProcessTaskTemplate'
import {ChildProcess, spawn, SpawnOptions} from 'child_process'
import {TaskContext, TaskInterruptionFlag} from '../types'

export interface ProcessOptions extends ChildProcessTaskProcessOptions, SpawnOptions {

}

export interface Result extends ChildProcessTaskResult {

}

export interface Options<POptions extends ProcessOptions> extends ChildProcessTaskOptions<POptions> {

}

export interface SpawnProcessTaskConstructor<PResult extends Result = Result,
                                             POptions extends ProcessOptions = ProcessOptions,
                                             PMessage = string,
                                             IResult = any> {
    new (options?: Options<POptions>): SpawnProcessTaskTemplate<PResult, POptions, PMessage, IResult>
}

export interface SpawnProcessTaskMethods<
    PResult extends Result = Result,
    POptions extends ProcessOptions = ProcessOptions,
    PMessage = string,
    IResult = any> {
    createResult: (this: ChildProcessTaskTemplate<PResult, POptions, PMessage, IResult>,
                   context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                   base: ChildProcessTaskResult) => PResult,
    getInterruptionResult: (this: ChildProcessTaskTemplate<PResult, POptions, PMessage, IResult>,
                            context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                            interruptionFlag: TaskInterruptionFlag) => Promise<IResult>,
    handleLine?: (this: ChildProcessTaskTemplate<PResult, POptions, PMessage, IResult>,
                  context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                  stream: ChildProcessReadableStream,
                  line: string) => void
    prepareChildProcess?: (this: ChildProcessTaskTemplate<PResult, POptions, PMessage, IResult>,
                           context: TaskContext<PResult, TaskArgs<POptions>, PMessage, IResult>,
                           childProcess: ChildProcess,
                           args: string[],
                           options: ProcessOptions) => Promise<ChildProcess>,
    getKillSignal?: (this: ChildProcessTaskTemplate<PResult, POptions, PMessage, IResult>,
                     context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                     interruptionFlag: TaskInterruptionFlag) => NodeJS.Signals | number
}

export default abstract class SpawnProcessTaskTemplate<
        PResult extends Result = Result,
        POptions extends ProcessOptions = ProcessOptions,
        PMessage = string,
        IResult = any
    > extends ChildProcessTaskTemplate<PResult, POptions, PMessage, IResult> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATIC CONSTRUCTOR ------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    static create(
        command: string,
        defaultOptions?: ProcessOptions,
        methods?: Partial<SpawnProcessTaskMethods>
    ): SpawnProcessTaskConstructor
    static create<
        PResult extends Result = Result,
        POptions extends ProcessOptions = ProcessOptions,
        PMessage = string,
        IResult = any>(
        command: string,
        defaultOptions: POptions,
        methods: SpawnProcessTaskMethods<PResult, POptions, PMessage, IResult>
    ): SpawnProcessTaskConstructor<PResult, POptions, PMessage, IResult>
    static create<
        PResult extends Result = Result,
        POptions extends ProcessOptions = ProcessOptions,
        PMessage = string,
        IResult = any>(
        command: string,
        defaultOptions?: ProcessOptions|POptions,
        methods?: Partial<SpawnProcessTaskMethods>|SpawnProcessTaskMethods<PResult, POptions, PMessage, IResult>
    ): SpawnProcessTaskConstructor|SpawnProcessTaskConstructor<PResult, POptions, PMessage, IResult> {
        if(defaultOptions !== undefined
            && methods !== undefined
            && 'createResult' in methods && typeof methods.createResult === 'function'
            && 'getInterruptionResult' in methods && typeof methods.getInterruptionResult === 'function') {
            return SpawnProcessTaskTemplate.createFull<PResult, POptions, PMessage, IResult>(
                command,
                defaultOptions as POptions,
                methods as SpawnProcessTaskMethods<PResult, POptions, PMessage, IResult>
            )
        } else {
            return SpawnProcessTaskTemplate.createSimple(command, defaultOptions, methods as SpawnProcessTaskMethods)
        }
    }

    protected static createSimple(command: string,
                                  defaultOptions: ProcessOptions = {},
                                  methods: Partial<SpawnProcessTaskMethods> = {}): SpawnProcessTaskConstructor {
        return SpawnProcessTaskTemplate.createFull(command, defaultOptions, {
            createResult: (context, base) => base,
            getInterruptionResult: async () => undefined,
            ...methods,
        })
    }

    protected static createFull<
        PResult extends Result = Result,
        POptions extends ProcessOptions = ProcessOptions,
        PMessage = string,
        IResult = any>(
            command: string,
            defaultOptions: POptions,
            methods: SpawnProcessTaskMethods<PResult, POptions, PMessage, IResult>
    ): SpawnProcessTaskConstructor<PResult, POptions, PMessage, IResult> {

        // Implement the abstract methods.
        const result = class extends SpawnProcessTaskTemplate<PResult, POptions, PMessage, IResult> {
            constructor(options: Options<POptions> = {}) {
                super(command, options)
            }

            protected createResult(context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                                   base: ChildProcessTaskResult): PResult {
                return methods.createResult.call(this, context, base)
            }

            protected get defaultTaskOptions(): POptions {
                return defaultOptions
            }

            protected getInterruptionResult(context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                                            interruptionFlag: TaskInterruptionFlag): Promise<IResult> {
                return methods.getInterruptionResult.call(this, context, interruptionFlag)
            }

            protected async startChildProcess(context: TaskContext<PResult, TaskArgs<POptions>, PMessage, IResult>,
                                              args: string[],
                                              options: ProcessOptions): Promise<ChildProcess> {
                if(methods.prepareChildProcess) {
                    const childProcess = await super.startChildProcess(context, args, options)
                    return await methods.prepareChildProcess.call(this, context, childProcess, args, options)
                } else {
                    return await super.startChildProcess(context, args, options)
                }
            }
        }

        // Implement the overwrite methods if they are set.
        if(methods.handleLine) { result.prototype.handleLine = methods.handleLine }
        if(methods.getKillSignal) { result.prototype.getKillSignal = methods.getKillSignal }

        // Return the result.
        return result
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected constructor(command: string, options: Options<POptions> = {}) {
        super(command, options)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- DEFAULT IMPLEMENTATION -------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected handleLine(context: TaskContext<PResult, ChildProcessTaskArgs<POptions>, PMessage, IResult>,
                         stream: ChildProcessReadableStream, line: string): void {
        return
    }

    protected async startChildProcess(context: TaskContext<PResult, ChildProcessTaskArgs<POptions>,
                                                           PMessage, IResult>,
                                      args: string[],
                                      options: ProcessOptions): Promise<ChildProcess> {
        return spawn(this.command, args, options)
    }

}
