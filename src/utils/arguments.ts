// -------------------------------------------------------------------------------------------------------------- //
//   Array arguments                                                                                              //
// -------------------------------------------------------------------------------------------------------------- //

export type ArgArray<V extends any> = V[]|V|null|undefined

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
