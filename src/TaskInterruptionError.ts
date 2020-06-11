/**
 * Interface for objects that will count as a [[TaskInterruptionError]].
 */
export interface TaskInterruptionErrorInterface<IResult = void> {
    readonly isInterruptionError: true
    readonly interruptionResult: IResult
}

/**
 * Checks if a object is a [[TaskInterruptionErrorInterface]] and thus can be viewed as an error that was thrown due
 * to an interruption.
 *
 * @param arg The variable that you want to check.
 */
export function isTaskInterruptionError<IResult = any>(arg: any): arg is TaskInterruptionErrorInterface<IResult> {
    return typeof arg === 'object'
        && 'isInterruptionError' in arg && arg.isInterruptionError
        && 'interruptionResult' in arg
}

/**
 * An extension of an Error that can be thrown when you want to indicate that a task was interrupted.
 */
export default class TaskInterruptionError<IResult = void>
    extends Error
    implements TaskInterruptionErrorInterface<IResult> {

    /**
     * Property that indicates that this is an interruption error.
     */
    readonly isInterruptionError: true = true

    /**
     * Property that contains the interruption error.
     */
    readonly interruptionResult: IResult

    /**
     * Constructor of the [[TaskInterruptionError]]
     *
     * @param interruptionResult
     * @param message
     */
    constructor(interruptionResult: IResult, message: string = 'Task was interrupted') {
        super(message)
        this.interruptionResult = interruptionResult
    }

}
