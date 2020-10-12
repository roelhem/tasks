import Factory from '../factories/Factory'
import {Queue, QueueProcessor} from './types'

export default class QueueManager<TResult = any, TArgs extends any[] = any[], PMessage = any, IResult = any>
    implements Queue<TResult, TArgs, PMessage, IResult> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    queue: Queue<TResult, TArgs, PMessage, IResult>
    factory: Factory<TResult, TArgs, PMessage, IResult>

    protected constructor(
        factory: Factory<TResult, TArgs, PMessage, IResult>,
        queue: Queue<TResult, TArgs, PMessage, IResult>
    ) {
        // Initialize the options.
        this.queue = queue
        this.factory = factory

        // Add the main processor.
        this.process(async (job) => {
            const task = this.factory.run(...job.args)
            const result = await task
            return result
        })
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENT: Queue<TResult, TArgs, PMessage, IResult> --------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    process(processor: QueueProcessor<TResult, TArgs, PMessage, IResult>): void {
        this.queue.process(processor)
    }

}
