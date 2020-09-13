import {Task} from './Task'
import {
    ChildProcessEvents,
    ChildProcessOptions,
    ChildProcessProvider, ChildProcessReadableStream,
    ChildProcessResult,
    ChildProcessSetup,
    ChildProcessType, LineHandler,
    TaskInterruptionFlag,
} from './types'
import * as cp from 'child_process'
import * as sudo from 'sudo-prompt'
import {ExecException, MessageOptions} from 'child_process'
import {Pipe, Readable, Writable} from 'stream'
import ChildProcessContext from './utils/ChildProcessContext'
import * as readline from 'readline'
import ChildProcessError from './ChildProcessError'
import ProcessEnvFilter from './utils/ProcessEnvFilter'

export default class ChildProcess<PData extends {} = {}, PMessage = any, IResult = any>
    extends Task<ChildProcessResult<PData>, string[], PMessage, IResult>
    implements ChildProcessProvider<PData, PMessage, IResult>, cp.ChildProcess {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATIC ------------------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * The default type of a [[ChildProcess]] when no [[ChildProcessType]] was provided in the options.
     */
    static defaultProcessType: ChildProcessType = 'spawn'
    static defaultEncoding: BufferEncoding = 'utf8'

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * A string containing the command that will be executed by this [[ChildProcess]].
     */
    readonly executable: string

    readonly processName: string

    /**
     * The type of the [[ChildProcess]].
     */
    readonly childProcessType: ChildProcessType
    readonly childProcessSetup: ChildProcessSetup<PData, PMessage, IResult>

    /**
     * Arguments that will be prepended to the arguments.
     */
    readonly prependArgs: string[]

    /**
     * Arguments that will be appended to the arguments.
     */
    readonly appendArgs: string[]

    /**
     * The default signal that will be send to the process if it should be killed.
     */
    readonly killSignal: NodeJS.Signals | number
    readonly interruptSignal: NodeJS.Signals | number

    readonly endEvent: 'exit'|'close'

    readonly argv0?: string

    readonly silent: boolean
    readonly nodeExecPath: string
    readonly nodeExecArgv: string[]


    readonly encoding: BufferEncoding
    readonly cwd?: string
    readonly gid?: number
    readonly uid?: number
    readonly shell: string|boolean
    readonly detached: boolean
    readonly icns?: string

    readonly maxBuffer?: number

    readonly childProcessTimeout: number|null

    readonly inheritEnv: ProcessEnvFilter
    env: NodeJS.ProcessEnv

    readonly windowsHide: boolean
    readonly allowNonZeroExitCode: boolean
    readonly windowsVerbatimArguments?: boolean

    readonly lineHandlers: Set<LineHandler<PData, PMessage, IResult>>

    /**
     * Store for the result data of this [[ChildProcess]]. Will be updated while the [[ChildProcess]] runs.
     */
    data: Partial<PData>


    constructor(provider: ChildProcessProvider<PData, PMessage, IResult>)
    /**
     * Constructor of the [[ChildProcess]].
     *
     * @param executable The command that should be executed by this [[ChildProcess]].
     * @param options The options for the [[ChildProcess]].
     */
    constructor(executable: string, options?: ChildProcessOptions<PData, PMessage, IResult>)
    constructor(arg0: string|ChildProcessProvider<PData, PMessage, IResult>,
                arg1: ChildProcessOptions<PData, PMessage, IResult> = {}) {
        const options = typeof arg0 === 'string' ? arg1 : arg0
        const executable = typeof arg0 === 'string' ? arg0 : arg0.executable
        super({
            task: (context, ...args) => this.runChildProcess(
                context as ChildProcessContext<PData, PMessage, IResult>,
                ...args
            ),
            ...options,
            taskName: options.taskName || options.processName || executable,
        })
        // Static init-values
        this.data = {}
        this._childProcess = null
        // Options
        this.childProcessType = options.childProcessType || ChildProcess.defaultProcessType
        this.childProcessSetup = options.childProcessSetup || (async () => { return })
        this.childProcessTimeout = typeof options.childProcessTimeout === 'number' && options.childProcessTimeout > 0 ?
            options.childProcessTimeout : null
        this.prependArgs = options.prependArgs || []
        this.appendArgs = options.appendArgs || []
        this.executable = executable
        this.killSignal = options.killSignal || 'SIGTERM'
        this.interruptSignal = options.interruptSignal || 'SIGINT'
        this.processName = options.processName || this.name || executable
        this.endEvent = options.endEvent || 'exit'
        this.argv0 = options.argv0
        this.cwd = options.cwd
        this.gid = options.gid
        this.uid = options.uid
        this.icns = options.icns
        this.detached = !!options.detached
        this.maxBuffer = options.maxBuffer
        this.encoding = options.encoding || ChildProcess.defaultEncoding
        this.shell = options.shell || false
        this.silent = !!options.silent
        this.allowNonZeroExitCode = !!options.allowNonZeroExitCode
        this.nodeExecPath = options.nodeExecPath || process.execPath
        this.nodeExecArgv = options.nodeExecArgv || process.execArgv
        this.windowsHide = !!options.windowsHide
        this.windowsVerbatimArguments = options.windowsVerbatimArguments
        // Env
        this.inheritEnv = options.inheritEnv instanceof ProcessEnvFilter
            ? options.inheritEnv
            : new ProcessEnvFilter(options.inheritEnv)
        this.env = {...this.inheritEnv(process.env), ...options.env || {}}
        // LineHandlers
        this.lineHandlers = new Set()
        if(options.lineHandlers) {
            for(const lineHandler of options.lineHandlers) {
                this.lineHandlers.add(lineHandler)
            }
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- CONVENIENCE GETTERS ----------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    get envStrings(): {[key: string]: string} {
        return Object.fromEntries(
            Object.entries(this.env).filter((item): item is [string, string] => typeof item[1] === 'string')
        )
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- HELPER METHODS ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected getFullCommand(args: string[] = []): string {
        return `${this.executable} ${args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ')}`
    }

    protected async runChildProcess(
        context: ChildProcessContext<PData, PMessage, IResult>,
        ...inputArgs: string[]
    ): Promise<ChildProcessResult<PData>> {
        // Run the setup.
        const setupResult = await this.childProcessSetup(context, ...inputArgs)

        // Add the environment variables if necessary
        if(setupResult && setupResult.env) {
            this.env = {
                ...this.env,
                ...setupResult.env,
            }
        }

        // Start the child process.
        const startResult = await this.startChildProcess(context, [
            ...this.prependArgs,
            ...setupResult && setupResult.prependArgs ? setupResult.prependArgs : [],
            ...inputArgs,
            ...setupResult && setupResult.appendArgs ? setupResult.appendArgs : [],
            ...this.appendArgs,
        ])

        // Return the result.
        return {
            childProcessType: this.childProcessType,
            childProcess: null,
            exitSignal: null,
            exitCode: null,
            stdout: null,
            stderr: null,
            data: this.data,
            ...startResult,
        }
    }

    protected startChildProcess(context: ChildProcessContext<PData, PMessage, IResult>, args: string[]): Promise<{
        exitCode?: number|null
        exitSignal?: string|null
        childProcess?: cp.ChildProcess|null
        stdout?: string
        stderr?: string
    }> {
        return new Promise((resolve, reject) => {
            try {
                switch (this.childProcessType) {
                    case 'exec': {
                        const childProcess = cp.exec(this.getFullCommand(args), {
                            env: this.env,
                            cwd: this.cwd,
                            gid: this.gid,
                            uid: this.uid,
                            maxBuffer: this.maxBuffer,
                            killSignal: this.killSignal,
                            shell: typeof this.shell === 'string' ? this.shell : undefined,
                            timeout: this.childProcessTimeout !== null ? this.childProcessTimeout : undefined,
                            encoding: this.encoding,
                            windowsHide: this.windowsHide,
                        }, (error: ExecException | null, stdout: string, stderr: string) => {
                            if (error && !this.allowNonZeroExitCode) {
                                reject(new ChildProcessError({
                                    ...error,
                                    stderr,
                                    stdout,
                                    childProcess: this,
                                }))
                            } else {
                                resolve({
                                    exitCode: error ? error.code : 0,
                                    exitSignal: error ? error.signal : undefined,
                                    childProcess,
                                    stdout,
                                    stderr,
                                })
                            }
                        })
                        this.initChildProcess(context, childProcess)
                        break
                    }
                    case 'execFile': {
                        const childProcess = cp.execFile(this.executable, args, {
                            windowsHide: this.windowsHide,
                            encoding: this.encoding,
                            uid: this.uid,
                            gid: this.gid,
                            cwd: this.cwd,
                            env: this.env,
                            killSignal: this.killSignal,
                            maxBuffer: this.maxBuffer,
                            shell: this.shell,
                            timeout: this.childProcessTimeout || undefined,
                            windowsVerbatimArguments: this.windowsVerbatimArguments,
                        }, (error: ExecException | null, stdout: string, stderr: string) => {
                            if (error && !this.allowNonZeroExitCode) {
                                reject(new ChildProcessError({
                                    ...error,
                                    stderr,
                                    stdout,
                                    childProcess: this,
                                }))
                            } else {
                                resolve({
                                    exitCode: error ? error.code : 0,
                                    exitSignal: error ? error.signal : undefined,
                                    childProcess,
                                    stdout,
                                    stderr,
                                })
                            }
                        })
                        this.initChildProcess(context, childProcess)
                        break
                    }
                    case 'fork': {
                        const childProcess = cp.fork(this.executable, args, {
                            uid: this.uid,
                            gid: this.gid,
                            cwd: this.cwd,
                            env: this.env,
                            detached: this.detached,
                            execArgv: this.nodeExecArgv,
                            execPath: this.nodeExecPath,
                            silent: this.silent,
                            windowsVerbatimArguments: this.windowsVerbatimArguments,
                        })
                        this.initChildProcess(context, childProcess, resolve, reject)
                        break
                    }
                    case 'spawn': {
                        const childProcess = cp.spawn(this.executable, args, {
                            windowsHide: this.windowsHide,
                            windowsVerbatimArguments: this.windowsVerbatimArguments,
                            shell: this.shell,
                            env: this.env,
                            cwd: this.cwd,
                            gid: this.gid,
                            uid: this.uid,
                            timeout: this.childProcessTimeout || undefined,
                            argv0: this.argv0,
                            detached: this.detached,
                        })
                        this.initChildProcess(context, childProcess, resolve, reject)
                        break
                    }
                    case 'sudoExec': {
                        sudo.exec(this.getFullCommand(args), {
                            env: this.envStrings,
                            name: this.name,
                            icns: this.icns,
                        }, (error, stdout, stderr) => {
                            if (error && !this.allowNonZeroExitCode) {
                                reject(new ChildProcessError({
                                    ...error,
                                    stderr: stderr ? stderr.toString() : undefined,
                                    stdout: stdout ? stdout.toString() : undefined,
                                    childProcess: this,
                                }))
                            } else {
                                resolve({
                                    exitCode: error ? (error as any).code || (error as any).exitCode || 1 : 0,
                                    exitSignal: error ? (error as any).signal || (error as any).exitSignal : undefined,
                                    stderr: stderr ? stderr.toString() : undefined,
                                    stdout: stdout ? stdout.toString() : undefined,
                                })
                            }
                        })
                        break
                    }
                    default: {
                        reject(new Error(`ChildProcessType '${this.childProcessType}' not implemented.`))
                        break
                    }
                }
            } catch (e) {
                console.log('ERROR', {e})
                reject(e)
            }
        })
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- ChildProcess Helper Methods --------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    private _childProcess: cp.ChildProcess|null
    get childProcess(): cp.ChildProcess|null {
        return this._childProcess
    }

    protected initChildProcess(
        context: ChildProcessContext<PData, PMessage, IResult>,
        childProcess: cp.ChildProcess,
        resolve?: (result: {
            exitCode?: number|null
            exitSignal?: string|null
            childProcess?: cp.ChildProcess|null
            stdout?: string
            stderr?: string
        }) => void,
        reject?: (reason: any) => void
    ): void {
        if(this._childProcess !== null) {
            throw new Error(`ChildProcess is already initialized.`)
        }

        // Forward the events.
        childProcess.once('close', this.emitLambda('close'))
        childProcess.once('exit', this.emitLambda('exit'))
        childProcess.once('disconnect', this.emitLambda('disconnect'))
        childProcess.once('error', this.emitLambda('error'))
        childProcess.on('message', this.emitLambda('message'))

        // Set resolve listener.
        if(resolve || reject) {
            childProcess.once(this.endEvent, (exitCode, exitSignal) => {
                if(this.allowNonZeroExitCode || !exitCode) {
                    if(resolve) {
                        resolve({
                            exitCode,
                            exitSignal,
                        })
                    }
                } else {
                    if(reject) {
                        reject(new ChildProcessError({
                            message: `ChildProcess '${this.processName}' exit with non-zero code ${exitCode}`,
                            childProcess: this,
                            code: exitCode,
                            signal: exitSignal,
                        }))
                    }
                }
            })
        }

        // Set the reject handler.
        if(reject) {
            childProcess.once('error', reject)
        }

        // Set interrupter that kill the childProcess.
        this.addInterrupter((flag) => {
            if(flag & TaskInterruptionFlag.FORCE) {
                childProcess.kill(this.killSignal)
            } else {
                childProcess.kill(this.interruptSignal)
            }
            return undefined as any
        })

        // Init line-handlers.
        this.initLineHandlers(context, 'stdout', childProcess.stdout)
        this.initLineHandlers(context, 'stderr', childProcess.stderr)

        // Store the childProcess.
        this._childProcess = childProcess
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- LineHandler Helpers ----------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected initLineHandlers(
        context: ChildProcessContext<PData, PMessage, IResult>,
        stream: ChildProcessReadableStream,
        readable?: Readable|null
    ): void {
        // Skip when readable is not defined.
        if(!readable) { return }

        // Create the readline Interface.
        readline.createInterface({ input: readable }).on('line', (line) => {
            this.emit('line', line, stream)
            for (const handler of this.lineHandlers) {
                handler.call(this, context, stream, line)
            }
        })
    }

    addLineHandler(lineHandler: LineHandler): this {
        this.lineHandlers.add(lineHandler)
        return this
    }

    deleteLineHandler(lineHandler: LineHandler): this {
        this.lineHandlers.delete(lineHandler)
        return this
    }

    clearLineHandlers(): this {
        this.lineHandlers.clear()
        return this
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- OVERRIDE: ChildProcess -------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected createContext(...args: string[]): ChildProcessContext<PData, PMessage, IResult> {
        return new ChildProcessContext(this, args)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENT: ChildProcess ------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    get stdin(): Writable|null {
        return this._childProcess ? this._childProcess.stdin : null
    }

    get stdout(): Readable|null {
        return this._childProcess ? this._childProcess.stdout : null
    }

    get stderr(): Readable|null {
        return this._childProcess ? this._childProcess.stderr : null
    }

    get channel(): Pipe|null|undefined {
        return this._childProcess ? this._childProcess.channel : undefined
    }

    get stdio(): cp.ChildProcess['stdio'] {
        return this._childProcess ? this._childProcess.stdio : [null, null, null, null, null]
    }

    get killed(): boolean {
        return this._childProcess ? this._childProcess.killed : false
    }

    get pid(): number {
        if(!this._childProcess) {
            throw new Error(`No node ChildProcess available, so pid couldn't be retrieved.`)
        }
        return this._childProcess.pid
    }

    get connected(): boolean {
        return this._childProcess ? this._childProcess.connected : false
    }

    get exitCode(): number|null {
        return this._childProcess ? this._childProcess.exitCode : null
    }

    get signalCode(): number|null {
        return this._childProcess ? this._childProcess.signalCode : null
    }

    get spawnargs(): string[] {
        return this._childProcess ? this._childProcess.spawnargs :
            this.childProcessType === 'fork' ? [
                    ...this.nodeExecArgv,
                    this.executable,
                    ...this.prependArgs,
                    ...this.appendArgs,
                ] : [
                    ...this.prependArgs,
                    ...this.appendArgs,
                ]
    }

    get spawnfile(): string {
        return this._childProcess ? this._childProcess.spawnfile :
            this.childProcessType === 'fork' ? this.nodeExecPath : this.executable
    }

    kill(signal?: NodeJS.Signals|number): boolean {
        if(!this._childProcess) {
            return false
        } else {
            return this._childProcess.kill(signal || this.killSignal)
        }
    }

    send(message: any,
         callback?: (error: Error | null) => void): boolean
    send(message: any,
         sendHandle?: any,
         callback?: (error: Error | null) => void): boolean
    send(message: any,
         sendHandle?: any,
         options?: MessageOptions,
         callback?: (error: Error | null) => void): boolean
    send(arg0: any, arg1?: any, arg2?: any, arg3?: any): boolean {
        if(!this._childProcess) {
            return false
        }
        return this._childProcess.send(arg0, arg1, arg2, arg3)
    }

    disconnect(): void {
        if(this._childProcess) {
            this._childProcess.disconnect()
        }
    }

    unref(): void {
        if(this._childProcess) {
            this._childProcess.unref()
        }
    }

    ref(): void {
        if(this._childProcess) {
            this._childProcess.ref()
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENTING: EventEmitter ---------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    addListener<K extends keyof ChildProcessEvents>(event: K, listener: ChildProcessEvents[K]): this
    addListener(event: string|symbol, listener: ((...args: any[]) => void)): this
    addListener(event: string|symbol, listener: ((...args: any[]) => void)): this {
        return super.addListener(event, listener)
    }

    on<K extends keyof ChildProcessEvents>(event: K, listener: ChildProcessEvents[K]): this
    on(event: string|symbol,    listener: ((...args: any[]) => void)): this
    on(event: string|symbol,    listener: ((...args: any[]) => void)): this {
        return super.on(event, listener)
    }

    once<K extends keyof ChildProcessEvents>(event: K, listener: ChildProcessEvents[K]): this
    once(event: string|symbol,    listener: ((...args: any[]) => void)): this
    once(event: string|symbol,    listener: ((...args: any[]) => void)): this {
        return super.once(event, listener)
    }

    removeListener<K extends keyof ChildProcessEvents>(event: K, listener: ChildProcessEvents[K]): this
    removeListener(event: string|symbol,    listener: ((...args: any[]) => void)): this
    removeListener(event: string|symbol,    listener: ((...args: any[]) => void)): this {
        return super.removeListener(event, listener)
    }

    off<K extends keyof ChildProcessEvents>(event: K, listener: ChildProcessEvents[K]): this
    off(event: string|symbol,    listener: ((...args: any[]) => void)): this
    off(event: string|symbol,    listener: ((...args: any[]) => void)): this {
        return super.off(event, listener)
    }

    removeAllListeners<K extends keyof ChildProcessEvents>(event?: K): this
    removeAllListeners(event?: string|symbol): this
    removeAllListeners(event?: string|symbol): this {
        return super.removeAllListeners(event)
    }

    listeners<K extends keyof ChildProcessEvents>(event: K): Function[]
    listeners(event: string | symbol): Function[]
    listeners(event: string | symbol): Function[] {
        return super.listeners(event)
    }

    rawListeners<K extends keyof ChildProcessEvents>(event: K): Function[]
    rawListeners(event: string | symbol): Function[]
    rawListeners(event: string | symbol): Function[] {
        return super.rawListeners(event)
    }

    emit<K extends keyof ChildProcessEvents>(event: K, ...args: Parameters<ChildProcessEvents[K]>): boolean
    emit(event: string|symbol,    ...args: any[]): boolean
    emit(event: string|symbol,    ...args: any[]): boolean {
        this.registerEvent(event)
        return super.emit(event, ...args)
    }

    listenerCount<K extends keyof ChildProcessEvents>(event: K): number
    listenerCount(event: string | symbol): number
    listenerCount(event: string | symbol): number {
        return super.listenerCount(event)
    }

    prependListener<K extends keyof ChildProcessEvents>(event: K, listener: ChildProcessEvents[K]): this
    prependListener(event: string|symbol, listener: ((...args: any[]) => void)): this
    prependListener(event: string|symbol, listener: ((...args: any[]) => void)): this {
        return super.prependListener(event, listener)
    }

    prependOnceListener<K extends keyof ChildProcessEvents>(event: K, listener: ChildProcessEvents[K]): this
    prependOnceListener(event: string|symbol, listener: ((...args: any[]) => void)): this
    prependOnceListener(event: string|symbol, listener: ((...args: any[]) => void)): this {
        return super.prependOnceListener(event, listener)
    }

    emitLambda<K extends keyof ChildProcessEvents>(event: K): ChildProcessEvents[K]
    emitLambda(event: string|symbol): ((...args: any[]) => void)
    emitLambda(event: string|symbol): ((...args: any[]) => void) {
        return (...args: any[]) => this.emit(event, ...args)
    }
}
