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
    for(const key of Object.getOwnPropertyNames(target)) {
        result[key as keyof I] = map(target[key as keyof I], key as keyof I)
    }
    return result as O
}
