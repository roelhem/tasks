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
    }, previous?: Error) {
        super(previous ? previous.message : options.message)
        const childProcess = options.childProcess
        this.childProcess = childProcess
        this.cwd = options.cwd || (childProcess ? childProcess.cwd : undefined)
        this.killed = options.killed || (childProcess ? childProcess.killed : undefined)
        this.code = options.code || (childProcess ? childProcess.exitCode || undefined : undefined)
        this.signal = options.signal
        this.stderr = options.stderr
        this.stdout = options.stdout
        this.name = this.constructor.name
        const messageName = previous ? previous.name : 'ChildProcessError'
        this.message = this.childProcess ? `${messageName} for '${this.childProcess}': ${this.message}` :
            options.message || `ChildProcessError.`

        this.stack = `${this.stack}${previous ? `\n\nPREVIOUS ERROR: \n\n${previous.stack}` : ''}`
    }

    get exitCode(): number|undefined {
        return this.code
    }

    get exitSignal(): NodeJS.Signals|undefined {
        return this.signal
    }


}
