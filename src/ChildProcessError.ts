import {ExecException} from 'child_process'
import ChildProcess from './ChildProcess'

export default class ChildProcessError extends Error implements ExecException {

    cwd?: string
    killed?: boolean
    code?: number
    signal?: NodeJS.Signals
    stderr?: string
    stdout?: string
    childProcess?: ChildProcess

    constructor(options: {
        message?: string
        childProcess?: ChildProcess
        cwd?: string
        killed?: boolean
        code?: number
        signal?: NodeJS.Signals
        stderr?: string
        stdout?: string
    }) {
        super(options.message)
        const childProcess = options.childProcess
        this.childProcess = childProcess
        this.cwd = options.cwd || (childProcess ? childProcess.cwd : undefined)
        this.killed = options.killed || (childProcess ? childProcess.killed : undefined)
        this.code = options.code || (childProcess ? childProcess.exitCode || undefined : undefined)
        this.signal = options.signal
        this.stderr = options.stderr
        this.stdout = options.stdout
        this.name = this.constructor.name
        this.message = this.childProcess ? `ChildProcessError for '${this.childProcess}': ${options.message}` :
            options.message || `ChildProcessError.`
    }

    get exitCode(): number|undefined {
        return this.code
    }

    get exitSignal(): NodeJS.Signals|undefined {
        return this.signal
    }


}
