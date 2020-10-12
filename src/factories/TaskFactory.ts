import Factory from './Factory'
import {TaskDefinition} from '../types'
import {Task} from '../Task'

export default class TaskFactory<TResult = any, TArgs extends any[] = any[], PMessage = any, IResult = any>
extends Factory<TResult, TArgs, PMessage, IResult> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    readonly definition: TaskDefinition<TResult, TArgs, PMessage, IResult>

    constructor(key: string, definition: TaskDefinition<TResult, TArgs, PMessage, IResult>) {
        super(key)
        this.definition = definition
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENT: Factory<TResult, TArgs, PMessage, IResult> ------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Creates the new [[Task]] Instance.
     */
    create(): Task<TResult, TArgs, PMessage, IResult> {
        return new Task<TResult, TArgs, PMessage, IResult>(this.key, this.definition)
    }

}
