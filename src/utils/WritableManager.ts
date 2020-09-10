import {Writable} from 'stream'

// -------------------------------------------------------------------------------------------------------------- //
//   Parsers                                                                                                      //
// -------------------------------------------------------------------------------------------------------------- //

export type Parser<T = any> = (data: T) => string|Buffer|Uint8Array

export type PredefinedParser = 'json'
export type PredefinedParserObject = Record<PredefinedParser, Parser>

export const predefinedParsers: PredefinedParserObject = {
    json: (data: any) => JSON.stringify(data),
}

export const DEFAULT_PARSER: PredefinedParser = 'json'

export function isPredefinedParser(input: any): input is PredefinedParser {
    return typeof input === 'string' && input in predefinedParsers
}

export function dataCanBeSendDirectly(input: any): input is string|Buffer|Uint8Array {
    return typeof input === 'string' || (
        typeof input === 'object' && input !== null && (
            input instanceof Buffer || input instanceof Uint8Array
        )
    )
}

// -------------------------------------------------------------------------------------------------------------- //
//   Stream Write                                                                                                 //
// -------------------------------------------------------------------------------------------------------------- //

export interface StreamWriteMethod<T = any> {
    (data: T, encoding?: BufferEncoding): Promise<void>
    (data: any, parser: PredefinedParser|'default', encoding?: BufferEncoding): Promise<void>
    (data: string, encoding?: BufferEncoding): Promise<void>
    (data: Buffer|Uint8Array): Promise<void>
}

// -------------------------------------------------------------------------------------------------------------- //
//   Manager                                                                                                      //
// -------------------------------------------------------------------------------------------------------------- //

export interface WritableManagerObject<T = never, S extends Writable = Writable> {
    readonly stream: S
    send: StreamWriteMethod<T>
}

export type WritableManager<T = any, S extends Writable = Writable> = StreamWriteMethod<T> & WritableManagerObject<T, S>

export class WritableManagerInstance<T = any, S extends Writable = Writable> implements WritableManagerObject<T, S> {

    static create<T = any, S extends Writable = Writable>(
        stream: S,
        parser: Parser<T>|PredefinedParser = DEFAULT_PARSER
    ): WritableManager<T, S> {
        const instance = new WritableManagerInstance<T, S>(stream, parser)
        const method = (data: any, ...args: any[]) => instance.send(data, ...args)
        return Object.assign(method, instance)
    }

    readonly stream: S
    protected parser: Parser<T>

    private constructor(stream: S, parser: Parser<T>|PredefinedParser = DEFAULT_PARSER) {
        this.stream = stream
        if(typeof parser === 'string') {
            this.parser = predefinedParsers[parser]
        } else {
            this.parser = parser
        }
    }

    send(data: T, encoding?: BufferEncoding): Promise<void>
    send(data: any, parser: PredefinedParser|'default', encoding?: BufferEncoding): Promise<void>
    send(data: string, encoding?: BufferEncoding): Promise<void>
    send(data: Buffer|Uint8Array): Promise<void>
    send(data: any|T|string|Buffer|Uint8Array,
         arg1?: PredefinedParser|'default'|BufferEncoding,
         arg2?: BufferEncoding): Promise<void> {
        // Interpret arguments
        const chosenParser = isPredefinedParser(arg1) || arg1 === 'default' ? arg1 : undefined
        const encoding = isPredefinedParser(arg1) || arg1 === 'default' ? arg2 : arg1

        // Parsing the data
        const parser = isPredefinedParser(chosenParser) ? predefinedParsers[chosenParser] : this.parser
        if(chosenParser !== undefined || !dataCanBeSendDirectly(data)) {
            data = parser(data)
        }

        // Returning the data
        return new Promise<void>((resolve, reject) => {
            const callback = (error: Error|null|undefined) => {
                if(error) { reject(error) }
                else { resolve() }
            }

            if (encoding) {
                this.stream.write(data, encoding, callback)
            } else {
                this.stream.write(data, callback)
            }
        })
    }
}

// -------------------------------------------------------------------------------------------------------------- //
//   Default Export                                                                                               //
// -------------------------------------------------------------------------------------------------------------- //

export function createWritableManager<T = any, S extends Writable = Writable>(
    stream: S,
    parser: Parser<T>|PredefinedParser = DEFAULT_PARSER): WritableManager<T, S> {
    return WritableManagerInstance.create(stream, parser)
}
