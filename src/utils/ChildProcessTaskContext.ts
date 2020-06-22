import {ChildProcessTaskArgs, ChildProcessTaskResult, ChildProcessOptions} from '../templates/ChildProcessTaskTemplate'
import TaskContext from './TaskContext'
import {ChildProcess} from 'child_process'
import {Task} from '../Task'

export type ChildProcessTask<
    RData extends {} = {},
    POptions extends ChildProcessOptions = ChildProcessOptions,
    PMessage = string,
    IResult = any
    > = Task<ChildProcessTaskResult<RData>, ChildProcessTaskArgs<POptions>, PMessage, IResult> & {
        data?: Partial<RData>
    }

export default class ChildProcessTaskContext<
    RData extends {} = {},
    POptions extends ChildProcessOptions = ChildProcessOptions,
    PMessage = string,
    IResult = any
    > extends TaskContext<ChildProcessTaskResult<RData>, ChildProcessTaskArgs<POptions>, PMessage, IResult> {

    readonly childProcessTask: ChildProcessTask<RData, POptions, PMessage, IResult>

    readonly originalContext
        : TaskContext<ChildProcessTaskResult<RData>, ChildProcessTaskArgs<POptions>, PMessage, IResult>

    readonly childProcess: ChildProcess
    readonly taskOptions: POptions

    constructor(
        originalContext: TaskContext<ChildProcessTaskResult<RData>, ChildProcessTaskArgs<POptions>, PMessage, IResult>,
        childProcess: ChildProcess,
        taskOptions: POptions
    ) {
        super(originalContext.task, originalContext.args)
        this.childProcessTask = originalContext.task
        this.originalContext = originalContext
        this.childProcess = childProcess
        this.taskOptions = taskOptions
    }

    setData(object: Partial<RData>): void
    setData<K extends keyof RData>(key: K, value: RData[K]): void
    setData<K extends keyof RData>(arg0: Partial<RData>|K, value?: RData[K]): void {
        if(typeof arg0 === 'string') {
            this.setDataProperty(arg0, value as RData[K])
        } else {
            this.setDataFromPartial(arg0 as Partial<RData>)
        }
    }

    pushData<K extends keyof RData>(key: K, value: RData[K] extends any[] ? RData[K][0] : never) {
        let array = (this.getData(key) as unknown) as any[]|undefined
        if(!Array.isArray(array)) {
            array = []
            this.setData(key, (array as unknown) as RData[K])
        }
        array.push(value)
    }

    hasData<K extends keyof RData>(key: K): boolean {
        return this.getData(key) !== undefined
    }

    getData(): Partial<RData>
    getData<K extends keyof RData>(key: K): RData[K]|undefined
    getData<K extends keyof RData>(key?: K): Partial<RData>|RData[K]|undefined {
        const data: Partial<RData> = this.childProcessTask.data || {}
        if (key === undefined) {
            return data
        } else {
            return data[key]
        }
    }

    protected setDataFromPartial(partial: Partial<RData>): void {
        Object.entries(partial).forEach(<K extends keyof RData>(entry:[string, any]) => {
            const key = entry[0] as K
            const value = entry[1] as RData[K]
            this.setDataProperty<K>(key, value)
        })
    }

    protected setDataProperty<K extends keyof RData>(key: K, value: RData[K]): void {
        if (this.childProcessTask.data === undefined) {
            this.childProcessTask.data = {}
        }
        this.childProcessTask.data[key] = value
    }

}
