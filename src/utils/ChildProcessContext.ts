import TaskContext from './TaskContext'
import {ChildProcessResult, LineHandler} from '../types'
import ChildProcess from '../ChildProcess'

export default class ChildProcessContext<PData extends {} = {}, PMessage = any, IResult = any>
    extends TaskContext<ChildProcessResult<PData>, string[], PMessage, IResult> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * A reference to the [[ChildProcess]] to which this context belongs.
     */
    readonly childProcess: ChildProcess<PData, PMessage, IResult>

    constructor(childProcess: ChildProcess<PData, PMessage, IResult>, args: string[]) {
        super(childProcess, args)
        this.childProcess = childProcess
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- DATA CONFIGURATION ------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    getData(): Partial<PData>
    getData<K extends keyof PData>(key: K): PData[K]|undefined
    getData<K extends keyof PData>(key?: K): Partial<PData>|PData[K]|undefined {
        if (key === undefined) {
            return this.childProcess.data
        } else {
            return this.childProcess.data[key]
        }
    }

    setData(object: Partial<PData>): this
    setData<K extends keyof PData>(key: K, value: PData[K]): this
    setData<K extends keyof PData>(arg0: Partial<PData>|K, value?: PData[K]): this {
        if(typeof arg0 === 'string') {
            this.setDataProperty(arg0, value as PData[K])
        } else {
            this.setDataFromPartial(arg0 as Partial<PData>)
        }
        return this
    }

    pushData<K extends keyof PData>(key: K, value: PData[K] extends any[] ? PData[K][0] : never) {
        let array = this.getData(key) as any
        if(!Array.isArray(array)) {
            array = []
            this.setData(key, (array as unknown) as PData[K])
        }
        array.push(value)
    }

    hasData<K extends keyof PData>(key: K): boolean {
        return this.getData(key) !== undefined
    }

    protected setDataProperty<K extends keyof PData>(key: K, value: PData[K]): void {
        this.childProcess.data[key] = value
    }

    protected setDataFromPartial(partial: Partial<PData>): this {
        Object.entries(partial).forEach(<K extends keyof PData>(entry:[string, any]) => {
            const key = entry[0] as K
            const value = entry[1] as PData[K]
            this.setDataProperty<K>(key, value)
        })
        return this
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- LineHandlers ------------------------------------------------------------------------------------------ //
    // ------------------------------------------------------------------------------------------------------------ //

    protected addLineHandler(lineHandler: LineHandler<PData, PMessage, IResult>): this {
        this.childProcess.addLineHandler(lineHandler)
        return this
    }

    protected deleteLineHandler(lineHandler: LineHandler<PData, PMessage, IResult>): this {
        this.childProcess.deleteLineHandler(lineHandler)
        return this
    }

    protected clearLineHandlers(): this {
        this.childProcess.clearLineHandlers()
        return this
    }

}
