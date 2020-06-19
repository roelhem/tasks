import {
    NamedTaskProvider, ProgressInheritance,
    ProgressInheritanceOffset, ProgressInheritanceRange,
    ProgressInheritanceScale,
    TaskDefinition,
    TaskFunction,
    TaskProvider
} from './types'
import {settings} from 'cluster'
import set = Reflect.set

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
}

// -------------------------------------------------------------------------------------------------------------- //
//   Options and Objects                                                                                          //
// -------------------------------------------------------------------------------------------------------------- //

export type EmptyValueOptionsSingle = any|any[]

export type EmptyValueOptionsPerProperty<O extends {}> = {
    [K in keyof O]?: EmptyValueOptionsSingle
}

export type EmptyValueOptions<O extends {}> = EmptyValueOptionsPerProperty<O> & {
    default?: EmptyValueOptionsSingle
}

export type EmptyValueOptionsInput<O> = EmptyValueOptionsSingle|EmptyValueOptions<O>

export type EmptyValueSettings<O extends {}> = {
    [K in keyof O]: any[]
}

// HELPER METHODS
function parseEmptyValueOptionsSingle(input: EmptyValueOptionsSingle): any[] {
    if(Array.isArray(input) && input.length > 0) {
        return input
    } else {
        return [input]
    }
}

export function mergeDefaultProps<O extends {}>(inputProps: Partial<O>,
                                                defaultProps: O,
                                                options: EmptyValueOptionsInput<O> = {}): O {
    // Getting the properties
    const properties: string[] = Object.getOwnPropertyNames(defaultProps)

    // PARSING THE OPTIONS
    function parseOptions(input: EmptyValueOptionsInput<O>): EmptyValueSettings<O> {
        if(typeof input === 'object' && input !== null && !Array.isArray(input)) {
            const settings = objectMap(input, parseEmptyValueOptionsSingle)
            if ('default' in settings) {
                return fillMissingProperties(properties, settings as { default: any[]}) as EmptyValueSettings<O>
            } else {
                return fillMissingProperties(properties, settings, [undefined]) as EmptyValueSettings<O>
            }
        } else {
            const singleSettings = parseEmptyValueOptionsSingle(input)
            return fillMissingProperties(properties, {}, singleSettings) as EmptyValueSettings<O>
        }
    }
    const settings = parseOptions(options)
    
    const result: Partial<O> = {...inputProps}
    for(const property of properties) {
        const p = property as keyof O
        const propEmptyValues = settings[p]
        if (!(p in inputProps) || propEmptyValues.indexOf(inputProps[p]) >= 0) {
            result[p] = defaultProps[p]
        }
    }
    return result as O
}

export function fillMissingProperties<V = any> (
    properties: string[],
    target: {[key: string]: V} & { default: V }): {[key: string]: V} & { default: V }
export function fillMissingProperties<V = any> (
    properties: string[],
    target: {[key: string]: V},
    defaultValue: V): {[key: string]: V}
export function fillMissingProperties<V = any>(
    properties: string[],
    target: {[key: string]: V}|({[key: string]: V} & { default: V }),
    defaultValue?: V): ({[key: string]: V} & { default: V })|{[key: string]: V}
{
    if (defaultValue === undefined && 'default' in target) {
       defaultValue = target.default
    } else if(defaultValue === undefined) {
        throw new Error(`No DefaultValue was found.`)
    }
    
    const newProps: {[key: string]: V} = {}
    for (const property of properties) {
        if(!(property in target)) {
            newProps[property] = defaultValue as V
        }
    }

    return Object.assign(target, newProps)
}

function objectMap<I extends {}, O extends {[RK in keyof I]: any}>(
    target: I,
    map: <K extends keyof I>(value: I[K], key: K) => O[K]
): O {
    const result: Partial<O> = {}
    for(const key in Object.getOwnPropertyNames(target)) {
        result[key as keyof I] = map(target[key as keyof I], key as keyof I)
    }
    return result as O
}

// -------------------------------------------------------------------------------------------------------------- //
//   Array arguments                                                                                              //
// -------------------------------------------------------------------------------------------------------------- //

export type ArgArray<V extends any> = V|V[]|null|undefined

export function argAsArray<V extends any>(input: ArgArray<V>): V[]
export function argAsArray<V extends any, D extends any = V[]>(input: ArgArray<V>,
                                                               defaultValue?: D): V[]|D
export function argAsArray<V extends any, D extends any = V[]>(input: ArgArray<V>,
                                                               defaultValue: V[]|D = []): V[]|D {
    if (input === undefined || input === null) {
        return defaultValue
    } else if (Array.isArray(input)) {
        return input
    } else {
        return [input]
    }
}

// -------------------------------------------------------------------------------------------------------------- //
//   Waiting                                                                                                      //
// -------------------------------------------------------------------------------------------------------------- //

function waitFor(milliseconds: number): Promise<void> {
    return new Promise<void>(resolve => {
        setTimeout(resolve, milliseconds)
    })
}
