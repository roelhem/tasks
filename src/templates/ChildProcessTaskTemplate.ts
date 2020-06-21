import {NamedTaskProvider} from '@/'
import {ChildProcess, CommonOptions, SendHandle, Serializable} from 'child_process'
import {TaskContext, TaskInterruptionFlag} from '../types'
import {ArgArray, argAsArray, mergeDefaultProps} from '../utils'
import * as readline from 'readline'
import {Readable, Writable} from 'stream'
import {createWritableManager, WritableManager} from './WritableManager'

export interface ProcessOptions extends CommonOptions {
    args?: string[]
    defaultKillSignal?: NodeJS.Signals | number
}

export interface Result {
    childProcess: ChildProcess
    code: number|null
    signal: string|null
}

export type ChildProcessWritableStream = 'stdin'
export type ChildProcessReadableStream = 'stdout'|'stderr'
export type ChildProcessStream = ChildProcessWritableStream|ChildProcessReadableStream

type GF = (...args: any[]) => any
type GlobalStreamHook<H extends GF = GF, S extends ChildProcessStream = ChildProcessStream>
    = (stream: S, ...args: Parameters<H>) => void
type SpecificStreamHook<H extends GF = GF, S extends ChildProcessStream = ChildProcessStream>
    = Partial<Record<S, H>>
type StreamHook<H extends GF = GF, S extends ChildProcessStream = ChildProcessStream>
    = GlobalStreamHook<H, S>|SpecificStreamHook<H, S>|(GlobalStreamHook<H, S>&SpecificStreamHook<H, S>)
type StreamHookCallback<H extends GF = GF,
                        S extends ChildProcessStream = ChildProcessStream,
                        I extends Readable|Writable = Readable|Writable>
    = (hook: H, stream: I, name: S) => void

export interface Hooks {
    onClose?: (code: number, signal: NodeJS.Signals) => void,
    onDisconnect?: () => void,
    onError?: (error: Error) => void,
    onExit?: (code: number|null, signal: NodeJS.Signals|null) => void,
    onMessage?: (message: Serializable, sendHandle: SendHandle) => void,
    onData?: StreamHook<(chunk: Buffer | string) => void, ChildProcessReadableStream>
    onLine?: StreamHook<(line: string) => void, ChildProcessReadableStream>
    onSendAvailable?: StreamHook<(send: WritableManager) => void, ChildProcessWritableStream>
}

export type WritableStreamMode = 'open'|'ignore'
export const DEFAULT_WRITABLE_STREAM_MODE: WritableStreamMode = 'ignore'
export interface WritableStreamConfig {
    mode: WritableStreamMode
}
export type ReadableStreamMode = 'data'|'line'
export const DEFAULT_READABLE_STREAM_MODE: ReadableStreamMode = 'line'
export interface ReadableStreamConfig {
    mode: ReadableStreamMode
}
export type StreamConfig = Record<ChildProcessReadableStream, ReadableStreamConfig>
                         & Record<ChildProcessWritableStream, WritableStreamConfig>
export type WritableStreamOptions = WritableStreamMode|Partial<WritableStreamConfig>
export type ReadableStreamOptions = ReadableStreamMode|Partial<ReadableStreamConfig>
export type StreamOptions = Partial<Record<ChildProcessWritableStream, WritableStreamOptions>>
                          & Partial<Record<ChildProcessReadableStream, ReadableStreamOptions>>

export type ChildProcessTaskContext<PResult, POptions, PMessage, IResult> =
    TaskContext<PResult, TaskArgs<POptions>, PMessage, IResult> & {
    childProcess: ChildProcess,
    taskOptions: POptions,
}

export interface Options<POptions extends ProcessOptions = ProcessOptions> {
    name?: string
    streams?: StreamOptions
    prefixArgs?: string[]
    defaultTaskOptions?: Partial<POptions>
    endEvent?: 'exit'|'close'
    inheritEnv?: boolean
    extraEnv?: NodeJS.ProcessEnv
}

export type TaskArgs<POptions extends ProcessOptions = ProcessOptions> = [Partial<POptions>?, Hooks?]

export default abstract class ChildProcessTaskTemplate<
        PResult extends Result = Result, POptions extends ProcessOptions = ProcessOptions,
        PMessage = string,
        IResult = any
    > implements NamedTaskProvider<PResult, TaskArgs<POptions>, PMessage, IResult> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATIC METHODS ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    static interpretReadableStreamOptions(options?: ReadableStreamOptions): ReadableStreamConfig {
        if (options === undefined) {
            return { mode: DEFAULT_READABLE_STREAM_MODE }
        } else if (typeof options === 'string') {
            return { mode: options }
        } else {
            return {
                mode: options.mode || DEFAULT_READABLE_STREAM_MODE,
            }
        }
    }

    static interpretWritableStreamOptions(options?: WritableStreamOptions): WritableStreamConfig {
        if (options === undefined) {
            return { mode: DEFAULT_WRITABLE_STREAM_MODE }
        } else if(typeof options === 'string') {
            return { mode: options }
        } else {
            return {
                mode: options.mode || DEFAULT_WRITABLE_STREAM_MODE,
            }
        }
    }

    static interpretStreamOptions(options: StreamOptions = {},
                                  readableStreams: ChildProcessReadableStream[] = ['stdout', 'stderr'],
                                  writableStreams: ChildProcessWritableStream[] = ['stdin']): StreamConfig {
        const result: Partial<StreamConfig> = {}
        for (const readableStream of readableStreams) {
            result[readableStream] = this.interpretReadableStreamOptions(options[readableStream])
        }
        for (const writableStream of writableStreams) {
            result[writableStream] = this.interpretWritableStreamOptions(options[writableStream])
        }
        return result as StreamConfig
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    readonly command: string
    readonly prefixArgs: string[]
    readonly inheritEnv: boolean
    readonly extraEnv: NodeJS.ProcessEnv
    readonly streamConfig: StreamConfig
    protected readableStreams: ChildProcessReadableStream[] = ['stdout', 'stderr']
    protected writableStreams: ChildProcessWritableStream[] = ['stdin']
    protected name?: string
    protected constructorDefaultTaskOptions: Partial<POptions>
    protected endEvent: 'exit'|'close'

    protected constructor(command: string, options: Options<POptions> = {}) {
        this.command = command
        this.prefixArgs = options.prefixArgs || []
        this.name = options.name
        this.constructorDefaultTaskOptions = options.defaultTaskOptions || {}
        this.endEvent = options.endEvent || 'close'
        this.inheritEnv = options.inheritEnv === undefined ? true : options.inheritEnv
        this.extraEnv = options.extraEnv || {}
        this.streamConfig = ChildProcessTaskTemplate.interpretStreamOptions(
            options.streams,
            this.readableStreams,
            this.writableStreams
        )
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- ABSTRACT METHODS -------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected abstract get defaultTaskOptions(): POptions

    protected abstract startChildProcess(context: TaskContext<PResult, TaskArgs<POptions>, PMessage, IResult>,
                                         args: string[],
                                         options: POptions): Promise<ChildProcess>

    protected abstract createResult(context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                                    base: Result): PResult

    protected abstract handleLine(context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                                  stream: ChildProcessReadableStream,
                                  line: string): void

    protected abstract getInterruptionResult(context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                                             interruptionFlag: TaskInterruptionFlag): Promise<IResult>

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- OVERRIDABLE METHODS ----------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected waitForEnd(context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                         childProcess: ChildProcess): Promise<PResult> {
        return new Promise<PResult>((resolve, reject) => {
            childProcess.on('error', err => {
                reject(err)
            })

            childProcess.on(this.endEvent, (code?: number|null, signal?: string|null) => {
                resolve(this.createResult(context, {
                    childProcess,
                    code: typeof code === 'number' ? code : null,
                    signal: typeof signal === 'string' ? signal : null,
                }))
            })
        })
    }

    protected getKillSignal(context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                            interruptionFlag: TaskInterruptionFlag): NodeJS.Signals | number {
        // TODO: Make this better
        return context.taskOptions.defaultKillSignal || 'SIGTERM'
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- CONVENIENCE GETTERS ----------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    get defaultName(): string {
        return [this.command, ...this.prefixArgs].join(' ')
    }

    get streams(): ChildProcessStream[] {
        return [...this.readableStreams, ...this.readableStreams]
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- HELPER METHODS ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected getTaskOptions(input: Partial<POptions>): POptions {
        const defaultTaskOptions = mergeDefaultProps(this.constructorDefaultTaskOptions, this.defaultTaskOptions)
        const result = mergeDefaultProps(input, defaultTaskOptions)
        result.env = this.getFullEnv(result.env)
        return result
    }

    protected hookToEvent(childProcess: ChildProcess, event: string, listener?: (...args: any) => void) {
        if(listener !== undefined) {
            childProcess.on(event, listener)
        }
    }

    protected getFullArgs(args?: string[]): string[] {
        if(args === undefined) {
            args = this.defaultTaskOptions.args || []
        }
        return [...this.prefixArgs, ...args]
    }

    protected getFullEnv(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
        if (env === undefined) {
            env = this.defaultTaskOptions.env || {}
        }

        return {
            ...(this.inheritEnv ? process.env : {}),
            ...this.extraEnv,
            ...env,
        }
    }

    protected getStream(childProcess: ChildProcess, stream: ChildProcessWritableStream): Writable|null
    protected getStream(childProcess: ChildProcess, stream: ChildProcessReadableStream): Readable|null
    protected getStream(childProcess: ChildProcess, stream: ChildProcessStream): Readable|Writable|null
    protected getStream(childProcess: ChildProcess, stream: ChildProcessStream): Readable|Writable|null {
        switch (stream) {
            case 'stderr': return childProcess.stderr
            case 'stdin': return childProcess.stdin
            case 'stdout': return childProcess.stdout
        }
    }

    protected getStreams(
        childProcess: ChildProcess,
        streamNames?: ChildProcessReadableStream[],
        withModes?: ArgArray<ReadableStreamMode>
    ): Map<ChildProcessReadableStream, Readable>
    protected getStreams(
        childProcess: ChildProcess,
        streamNames?: ChildProcessWritableStream[],
        withModes?: ArgArray<WritableStreamMode>
    ): Map<ChildProcessWritableStream, Writable>
    protected getStreams(
        childProcess: ChildProcess,
        streamNames?: ChildProcessStream[],
        withModes?: ArgArray<WritableStreamMode | ReadableStreamMode>
    ): Map<ChildProcessStream, Readable|Writable> {
        withModes = argAsArray(withModes, undefined)
        streamNames = streamNames || this.streams
        const result = new Map<ChildProcessStream, Readable|Writable>()
        for (const streamName of streamNames) {
            const streamMode = this.streamConfig[streamName].mode
            const stream = this.getStream(childProcess, streamName)
            if (stream !== null && (withModes === undefined || withModes.indexOf(streamMode) >= 0)) {
                result.set(streamName, stream)
            }
        }
        return result
    }

    protected getWritableStreams(
        childProcess: ChildProcess,
        withModes?: ArgArray<WritableStreamMode>
    ): Map<ChildProcessWritableStream, Writable> {
        return this.getStreams(childProcess, this.writableStreams, withModes)
    }

    protected getReadableStreams(
        childProcess: ChildProcess,
        withModes?: ReadableStreamMode|ReadableStreamMode[]
    ): Map<ChildProcessReadableStream, Readable> {
        return this.getStreams(childProcess, this.readableStreams, withModes)
    }

    protected initReadline(context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                           childProcess: ChildProcess,
                           stream: ChildProcessReadableStream): readline.Interface|null {
        // Check the stream mode.
        if (this.streamConfig[stream].mode !== 'line') {
            return null
        }

        // Check if the stream exists.
        const input = this.getStream(childProcess, stream)
        if(input === null) {
            return null
        }

        // Create the interface
        const result = readline.createInterface({ input })
        result.on('line', (line: string) => {
            this.handleLine(context, stream, line)
        })

        // Return the result
        return result
    }

    protected initReadlineStreams(context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                                  childProcess: ChildProcess): Map<ChildProcessReadableStream, readline.Interface> {
        const res = new Map<ChildProcessReadableStream, readline.Interface>()
        for (const stream of this.readableStreams) {
            const rl = this.initReadline(context, childProcess, stream)
            if(rl !== null) {
                res.set(stream, rl)
            }
        }
        return res
    }

    protected configStreamHook<H extends GF>(hook: StreamHook<H, ChildProcessReadableStream>|undefined,
                                             map: Map<ChildProcessReadableStream, Readable>,
                                             cb: StreamHookCallback<H, ChildProcessReadableStream, Readable>): void
    protected configStreamHook<H extends GF>(hook: StreamHook<H, ChildProcessWritableStream>|undefined,
                                             map: Map<ChildProcessWritableStream, Writable>,
                                             cb: StreamHookCallback<H, ChildProcessWritableStream, Writable>): void
    protected configStreamHook<H extends GF>(hook: StreamHook<H>|undefined,
                                             map: Map<ChildProcessStream, Readable|Writable>,
                                             cb: StreamHookCallback<H>): void
    protected configStreamHook<H extends GF>(hook: StreamHook<H>|undefined,
                                             map: Map<ChildProcessReadableStream, Readable>
                                                   |Map<ChildProcessWritableStream, Writable>
                                                   |Map<ChildProcessStream, Readable|Writable>,
                                             cb: StreamHookCallback<H, ChildProcessReadableStream, Readable>
                                                   |StreamHookCallback<H, ChildProcessWritableStream, Writable>
                                                   |StreamHookCallback<H>): void {
        if (typeof hook === 'function') {
            map.forEach((stream, streamName) => {
                const proxyHook = (...args: Parameters<H>) => hook(streamName, ...args)
                const arg0 = (proxyHook as unknown) as H
                const arg1 = (stream as unknown) as Readable & Writable
                const arg2 = (streamName as unknown) as never
                cb(arg0, arg1, arg2)
            })
        }

        if(typeof hook === 'function' || (typeof hook === 'object' && hook !== null)) {
            for (const [streamName, subHook] of Object.entries(hook)) {
                const stream = map.get(streamName as never)
                if(stream !== undefined) {
                    cb(subHook as H, stream as Readable & Writable, streamName as never)
                }
            }
        }
    }

    protected registerDataHooks(childProcess: ChildProcess, hooks: Hooks) {
        const map = this.getReadableStreams(childProcess, ['data', 'line'])
        this.configStreamHook(hooks.onData, map, (hook, stream) => {
            stream.on('data', chunk => hook(chunk))
        })
    }

    protected registerSendAvailableHooks(childProcess: ChildProcess, hook: Hooks) {
        const map = this.getWritableStreams(childProcess, ['open'])
        this.configStreamHook(hook.onSendAvailable, map, (hook, stream: Writable) => {
            const writableManager = createWritableManager(stream)
            hook(writableManager)
        })
    }

    protected registerReadlineHooks(readlineMap: Map<ChildProcessReadableStream, readline.Interface>, hooks: Hooks) {
        const onLine = hooks.onLine
        if (typeof onLine === 'function') {
            readlineMap.forEach((rl, stream) => {
                rl.on('line', (line: string) => {
                    onLine(stream, line)
                })
            })
        }

        if (typeof onLine === 'function' || typeof onLine === 'object' && onLine !== null) {
            for (const entry of Object.entries(onLine)) {
                const [stream, hook] = entry as [ChildProcessReadableStream, (line: string) => void]
                const rl = readlineMap.get(stream)
                if (rl) {
                   rl.on('line', hook)
                }
            }
        }
    }

    protected async killChildProcess(context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                                     interruptionFlag: TaskInterruptionFlag): Promise<IResult> {
        const killSignal = this.getKillSignal(context, interruptionFlag)

        context.childProcess.kill(killSignal)

        // TODO: Wait for terminate

        return await this.getInterruptionResult(context, interruptionFlag)
    }

    protected async createChildProcessTaskContext(
        context: TaskContext<PResult, TaskArgs<POptions>, PMessage, IResult>,
        childProcess: ChildProcess,
        taskOptions: POptions
    ): Promise<ChildProcessTaskContext<PResult, POptions, PMessage, IResult>> {
        return Object.assign(context, {
            childProcess,
            taskOptions,
        })
    }


    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENTING: NamedTaskProvider ----------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    get taskName(): string {
        return this.name || this.defaultName
    }

    async task(
        context: TaskContext<PResult, TaskArgs<POptions>, PMessage, IResult>,
        ...args: TaskArgs<POptions>
    ): Promise<PResult> {
        // Getting the args
        const options: POptions = this.getTaskOptions(args[0] || {})
        const hooks: Hooks = args[1] || {}

        // Starting the child process.
        const processArguments = this.getFullArgs(options.args || [])
        const childProcess = await this.startChildProcess(context, processArguments, options)
        const childProcessTaskContext = await this.createChildProcessTaskContext(context, childProcess, options)

        // Initialising the killed.
        context.setInterrupter(flag => this.killChildProcess(childProcessTaskContext, flag))

        // Initialising the readline streams.
        const readlineMap = this.initReadlineStreams(childProcessTaskContext, childProcess)

        // Registering the hooks.
        this.hookToEvent(childProcess, 'close', hooks.onClose)
        this.hookToEvent(childProcess, 'disconnect', hooks.onDisconnect)
        this.hookToEvent(childProcess, 'error', hooks.onError)
        this.hookToEvent(childProcess, 'exit', hooks.onExit)
        this.hookToEvent(childProcess, 'message', hooks.onMessage)
        this.registerDataHooks(childProcess, hooks)
        this.registerReadlineHooks(readlineMap, hooks)
        this.registerSendAvailableHooks(childProcess, hooks) // Should be last

        // Wait for the termination
        return await this.waitForEnd(childProcessTaskContext, childProcess)
    }

}
