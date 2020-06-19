import ChildProcessTaskTemplate, {
    Options as ChildProcessTaskOptions,
    ProcessOptions as ChildProcessTaskProcessOptions,
    Result as ChildProcessTaskResult,
    TaskArgs as ChildProcessTaskArgs,
} from './ChildProcessTaskTemplate'
import {ChildProcess, spawn, SpawnOptions} from 'child_process'
import {TaskContext} from '../types'

export interface ProcessOptions extends ChildProcessTaskProcessOptions, SpawnOptions {

}

export interface Result extends ChildProcessTaskResult {

}

export interface Options extends ChildProcessTaskOptions<ProcessOptions> {

}

export default class SpawnProcessTaskTemplate<PMessage = string, IResult = any>
    extends ChildProcessTaskTemplate<Result, ProcessOptions, PMessage, IResult> {

    constructor(command: string, options: Options = {}) {
        super(command, options)
    }

    protected createResult(context: TaskContext<Result, ChildProcessTaskArgs<ProcessOptions>, PMessage, IResult>,
                           base: ChildProcessTaskResult): Result {
        return base
    }

    protected get defaultTaskOptions(): ProcessOptions {
        return {}
    }

    protected handleLine(context: TaskContext<Result, ChildProcessTaskArgs<ProcessOptions>, PMessage, IResult>,
                         stream: 'stdout' | 'stderr', line: string): void {
        return
    }

    protected async startChildProcess(context: TaskContext<Result, ChildProcessTaskArgs<ProcessOptions>,
                                                           PMessage, IResult>,
                                      args: string[],
                                      options: ProcessOptions): Promise<ChildProcess> {
        return spawn(this.command, args, options)
    }

}
