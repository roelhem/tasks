import {TaskContext, TaskProvider} from '../types'

export default class TriggerableTaskTemplate<TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any>
    implements TaskProvider<TResult, TArgs, PMessage, IResult>, Promise<void> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    readonly [Symbol.toStringTag]: string

    /**
     * The name of the task, if available.
     */
    taskName?: string

    /**
     * Boolean that checks if the task was called.
     */
    private _started: boolean = false

    /**
     * The arguments with whom the task called. Will be set when the task hasn't been called.
     */
    private _args?: TArgs

    /**
     * The context with whom the task was called. Will be set when the task hasn't been called.
     */
    private _context?: TaskContext<TResult, TArgs, PMessage, IResult>

    private _promise: Promise<void>
    private _promiseResolver!: () => void

    /**
     * The constructor, which will just set the taskName if provided.
     */
    constructor(taskName?: string) {
        this.taskName = taskName
        this[Symbol.toStringTag] = taskName ? `TriggerableTaskTemplate[${taskName}]` : `TriggerableTaskTemplate`
        this._promise = new Promise<void>(resolve => this._promiseResolver = resolve)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- EXTRA GETTERS ----------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Is `true` if the task has been called.
     */
    get started(): boolean {
        return this._started
    }

    get args(): TArgs {
        this.assertStarted(`Can't get the arguments.`)
        return this._args as TArgs
    }

    get context(): TaskContext<TResult, TArgs, PMessage, IResult> {
        this.assertStarted(`Can't get the context.`)
        return this._context as TaskContext<TResult, TArgs, PMessage, IResult>
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- HELPER METHODS ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Asserts that this [[TriggerableTask]] has been called, which ensures that the `argument` and `controller`
     * properties are set.
     *
     * @param message The message describing the function was tried to call.
     * @category assertion
     */
    protected assertStarted(message: string = `Can't call this function.`) {
        if(!this.started) {
            throw new Error(`${message} (The task hasn't been called yet.)`)
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENTING: TaskProvider ---------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * The task-function defining the task. It will set the `started` as boolean, `context` and `args` properties.
     *
     * It implements the `task`-method of the [[TaskProvider]] interface.
     *
     * @param context The context of the task.
     * @param args The arguments with whom the task are called.
     */
    task(context: TaskContext<TResult, TArgs, PMessage, IResult>, ...args: TArgs): void {
        // Setting the properties.
        this._started = true
        this._context = context
        this._args = args

        // Resolving the promise.
        this._promiseResolver()
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENTING: Promise<void> --------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    catch<TResult = never>(
        onRejected?: ((reason: any) => (PromiseLike<TResult> | TResult)) | undefined | null
    ): Promise<void | TResult> {
        return this._promise.catch(onRejected)
    }

    finally(
        onFinally?: (() => void) | undefined | null
    ): Promise<void> {
        return this._promise.finally(onFinally)
    }

    then<TResult1 = void, TResult2 = never>(
        onFulfilled?: ((value: void) => (PromiseLike<TResult1> | TResult1)) | undefined | null,
        onRejected?: ((reason: any) => (PromiseLike<TResult2> | TResult2)) | undefined | null
    ): Promise<TResult1 | TResult2> {
        return this._promise.then(onFulfilled, onRejected)
    }

}
