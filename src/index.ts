import {Task} from './Task'
import {
    TaskConstructorFunction,
    TaskDefinition,
    TaskFacade,
    TaskInterruptionFlag,
    TaskRunnerFunction,
    TaskState
} from './types'
import TaskInterruptionError from './TaskInterruptionError'
import {isTaskDefinition} from './utils'

const taskConstructorFunction: TaskConstructorFunction =
    <TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any>(
        arg0: string|TaskDefinition<TResult, TArgs, PMessage, IResult>,
        arg1?: TaskDefinition<TResult, TArgs, PMessage, IResult>
    ): Task<TResult, TArgs, PMessage, IResult> => {
        if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg0)) { // TYPE 1
            return new Task<TResult, TArgs, PMessage, IResult>(arg0)
        } else if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg1)) { // TYPE 2
            return new Task<TResult, TArgs, PMessage, IResult>(arg0, arg1)
        } else {
            throw new TypeError(`No TaskDefinition given.`)
        }
    }

const taskRunnerFunction: TaskRunnerFunction =
    <TResult = void, TArgs extends any[] = [], PMessage = string, IResult = any>(
        arg0: string|TaskDefinition<TResult, TArgs, PMessage, IResult>,
        arg1?: TaskDefinition<TResult, TArgs, PMessage, IResult>|any,
        ...others: any[]
    ): Task<TResult, TArgs, PMessage, IResult> => {
        if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg0)) { // TYPE 1
            return taskConstructorFunction(arg0).run(...[arg1, ...others] as TArgs)
        } else if(isTaskDefinition<TResult, TArgs, PMessage, IResult>(arg1)) { // TYPE 2
            return taskConstructorFunction(arg0, arg1).run(...others as TArgs)
        } else {
            throw new TypeError(`No TaskDefinition given.`)
        }
    }

const task: TaskFacade = Object.assign(taskConstructorFunction, {
    run: taskRunnerFunction,
    create: taskConstructorFunction,
    READY: TaskState.READY as TaskState.READY,
    RUNNING: TaskState.RUNNING as TaskState.RUNNING,
    SUCCEEDED: TaskState.SUCCEEDED as TaskState.SUCCEEDED,
    FAILED: TaskState.FAILED as TaskState.FAILED,
    INTERRUPTED: TaskState.INTERRUPTED as TaskState.INTERRUPTED,
    INTERRUPT_DEFAULT: TaskInterruptionFlag.DEFAULT as TaskInterruptionFlag.DEFAULT,
    INTERRUPT_USER: TaskInterruptionFlag.USER as TaskInterruptionFlag.USER,
    INTERRUPT_EXIT: TaskInterruptionFlag.EXIT as TaskInterruptionFlag.EXIT,
    INTERRUPT_TEST: TaskInterruptionFlag.TEST as TaskInterruptionFlag.TEST,
    INTERRUPT_FROM_PARENT: TaskInterruptionFlag.FROM_PARENT as TaskInterruptionFlag.FROM_PARENT,
    INTERRUPT_FROM_CHILD: TaskInterruptionFlag.FROM_CHILD as TaskInterruptionFlag.FROM_CHILD,
    INTERRUPT_FROM_FAILURE: TaskInterruptionFlag.FROM_FAILURE as TaskInterruptionFlag.FROM_FAILURE,
})

export default task
export * from './Task'
export * from './types'
export { TaskInterruptionError }
export * from './templates'
export * from './utils'
