import Factory from './Factory'
import {Arguments} from 'yargs'
import {CommandDescription} from '../types'
import Command from '../Command'

export default class CommandFactory<CResult=any, CArgs extends {}={}, GArgs extends {}={}, PMessage=any, IResult=any>
extends Factory<CResult, [Arguments<CArgs & GArgs>], PMessage, IResult> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    readonly description: CommandDescription<CResult, CArgs, GArgs, PMessage, IResult>

    constructor(key: string,
                description: CommandDescription<CResult, CArgs, GArgs, PMessage, IResult>) {
        super(key)
        this.description = description
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENT: Factory<CResult, [Arguments<CArgs & GArgs>], PMessage, IResult> ---------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    create(): Command<CResult, CArgs, GArgs, PMessage, IResult> {
        return new Command<CResult, CArgs, GArgs, PMessage, IResult>(this.description)
    }
}
