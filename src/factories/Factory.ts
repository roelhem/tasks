import {Task} from '../Task'
import PreparedTask from '../PreparedTask'
import {NamedTaskProvider} from '../types'
import TaskContext from '../utils/TaskContext'

export default abstract class Factory<TResult = any, TArgs extends any[] = any[], PMessage = any, IResult = any>
    implements NamedTaskProvider<TResult, TArgs, PMessage, IResult> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * The key of this [[Factory]]. Used to refer to it from the [[Facade]].
     */
    readonly key: string

    protected constructor(key: string) {
        this.key = key
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- ABSTRACT METHODS -------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Method that creates a new [[Task]] that this [[Factory]] provides.
     */
    abstract create(): Task<TResult, TArgs, PMessage, IResult>

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- OTHER METHODS ----------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Runs a new [[Task]] created by this [[Factory]].
     *
     * @param args The arguments of the [[Task]].
     */
    run(...args: TArgs): Task<TResult, TArgs, PMessage, IResult> {
        return this.create().run(...args)
    }

    /**
     * Creates a new [[Task]] and prepares the.
     *
     * @param args The arguments of the [[Task]].
     */
    prepare(...args: TArgs): PreparedTask<TResult, TArgs, PMessage, IResult> {
        return this.create().prepare(...args)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENTS: NamedTaskProvider ------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    task(context: TaskContext<TResult, TArgs, PMessage, IResult>, ...args: TArgs): Promise<TResult> | void | TResult {
        return this.create().task(context, ...args)
    }

    get taskName(): string {
        return this.create().taskName || this.key
    }

    get progressThrottle(): number {
        return this.create().progressThrottle
    }

    get taskSetup(): (task: Task<TResult, TArgs, PMessage, IResult>) => void {
        return this.create().taskSetup
    }
}
