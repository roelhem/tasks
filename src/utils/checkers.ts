import {
    NamedTaskProvider,
    ProgressInheritance,
    ProgressInheritanceOffset, ProgressInheritanceOptions,
    ProgressInheritanceRange,
    ProgressInheritanceScale,
    TaskDefinition,
    TaskFunction,
    TaskProvider
} from '../types'

// -------------------------------------------------------------------------------------------------------------- //
//   Task Definition                                                                                              //
// -------------------------------------------------------------------------------------------------------------- //

export function isTaskFunction<TResult = any, TArgs extends any[] = any[], PMessage = any, IResult = any>(arg: any):
    arg is TaskFunction<TResult, TArgs, PMessage, IResult> {
    return typeof arg === 'function'
}

export function isTaskProvider<TResult = any, TArgs extends any[] = any[], PMessage = any, IResult = any>(arg: any):
    arg is TaskProvider<TResult, TArgs, PMessage, IResult> {
    return typeof arg === 'object' && arg !== null
        && 'task' in arg
        && isTaskFunction<TResult, TArgs, PMessage, IResult>(arg.task)
}

export function isNamedTaskProvider<TResult = any, TArgs extends any[] = any[], PMessage = any, IResult = any>(
    arg: any
): arg is NamedTaskProvider<TResult, TArgs, PMessage, IResult> {
    return isTaskProvider<TResult, TArgs, PMessage, IResult>(arg)
        && 'taskName' in arg
        && typeof arg.taskName === 'string'
}

export function isTaskDefinition<TResult = any, TArgs extends any[] = any[], PMessage = any, IResult = any>(arg: any):
    arg is TaskDefinition<TResult, TArgs, PMessage, IResult> {
    return isTaskFunction<TResult, TArgs, PMessage, IResult>(arg)
        || isTaskProvider<TResult, TArgs, PMessage, IResult>(arg)
}

// -------------------------------------------------------------------------------------------------------------- //
//   Task Progress-definition type-checkers                                                                       //
// -------------------------------------------------------------------------------------------------------------- //

export function isProgressInheritanceScale(arg: any): arg is ProgressInheritanceScale {
    return typeof arg === 'number'
}

export function isProgressInheritanceOptions(arg: any): arg is ProgressInheritanceOptions {
    return typeof arg === 'object' && arg !== null && arg.inheritProgress === true
}

export function isProgressInheritanceOffset(arg: any): arg is ProgressInheritanceOffset {
    return Array.isArray(arg) && arg.length === 1 && typeof arg[0] === 'number'
}

export function isProgressInheritanceRange(arg: any): arg is ProgressInheritanceRange {
    return Array.isArray(arg) && arg.length === 2 && typeof arg[0] === 'number' && typeof arg[1] === 'number'
}

export function isProgressInheritance(arg: any): arg is ProgressInheritance {
    return isProgressInheritanceScale(arg)
        || isProgressInheritanceOffset(arg)
        || isProgressInheritanceRange(arg)
        || isProgressInheritanceOptions(arg)
}
