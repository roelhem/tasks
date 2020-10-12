import Factory from './Factory'
import {ChildProcessDescription, ChildProcessResult} from '../types'
import ChildProcess from '../ChildProcess'

export default class ChildProcessFactory<PData extends {} = {}, PMessage = any, IResult = any>
extends Factory<ChildProcessResult<PData>, string[], PMessage, IResult> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    definition: ChildProcessDescription<PData, PMessage, IResult>

    constructor(key: string, definition: ChildProcessDescription<PData, PMessage, IResult>) {
        super(key)
        this.definition = definition
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENT: Factory<ChildProcessResult<PData>, string[], PMessage, IResult> ---------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    create(): ChildProcess<PData, PMessage, IResult> {
        return new ChildProcess<PData, PMessage, IResult>(this.definition)
    }

}
