import {ArgArray, argAsArray} from './arguments'
import ChildProcess from '../ChildProcess'
import ChildProcessContext from './ChildProcessContext'
import {LineHandler, ChildProcessReadableStream} from '../types'
import Callable from './Callable'

export interface LineMatch {
    line: string
    match: string
    parts: string[]
    groups: {[key: string]: string}
}

export type LineMatcherFunction = (line: string) => LineMatch|null
export type LineMatcherDefinition = string|RegExp|LineMatcherFunction

export type LineMatcherHandler<
    PData extends {} = {},
    PMessage = any,
    IResult = any
    > = (this: ChildProcess<PData, PMessage, IResult>,
         context: ChildProcessContext<PData, PMessage, IResult>,
         match: LineMatch, stream: ChildProcessReadableStream) => void

export interface LineMatcherEntry<
    PData extends {} = {},
    PMessage = any,
    IResult = any
    > {
    matcher: LineMatcherFunction
    streams: null|ChildProcessReadableStream[]
    handler: LineMatcherHandler<PData, PMessage, IResult>
}

export interface Options<PData extends {} = {}, PMessage = any, IResult = any> {
    neverParseStringToRegex?: boolean
    fallbackHandler?: LineHandler<PData, PMessage, IResult>
}

export class LineMatcher<PData extends {} = {}, PMessage = any, IResult = any> extends Callable<LineHandler> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected entries: LineMatcherEntry<PData, PMessage, IResult>[]
    protected fallbackHandler?: LineHandler<PData, PMessage, IResult>

    readonly neverParseStringToRegex: boolean

    constructor(options: Options = {}) {
        let self: this
        super(function (
            this: ChildProcess<PData, PMessage, IResult>,
            context: ChildProcessContext<PData, PMessage, IResult>,
            stream: ChildProcessReadableStream,
            line: string
        ) { self.lineHandler.call(this, context, stream, line) })
        self = this
        this.entries = []
        this.neverParseStringToRegex = !!options.neverParseStringToRegex
        this.fallbackHandler = options.fallbackHandler
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- MANAGE ENTRIES ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    add(matcher: LineMatcherDefinition,
        handler?: LineMatcherHandler<PData, PMessage, IResult>,
        streams?: ArgArray<ChildProcessReadableStream>): LineMatcherEntry<PData, PMessage, IResult> {
        const result: LineMatcherEntry<PData, PMessage, IResult> = {
            matcher: this.getMatcherFunction(matcher),
            handler: handler || (() => { return }),
            streams: argAsArray(streams, null),
        }
        this.entries.push(result)
        return result
    }

    match(stream: ChildProcessReadableStream,
          line: string): LineMatch[] {
        return this.entries.map((entry) => {
            if(entry.streams === null || entry.streams.indexOf(stream) >= 0) {
                return entry.matcher(line)
            } else {
                return null
            }
        }).filter((math) => math !== null ) as LineMatch[]
    }

    setFallback(handler: LineHandler<PData, PMessage, IResult>) {
        this.fallbackHandler = handler
    }

    get lineHandler(): LineHandler<PData, PMessage, IResult> {
        const entries = this.entries
        const fallbackHandler = this.fallbackHandler
        return function (this: ChildProcess<PData, PMessage, IResult>,
                         context: ChildProcessContext<PData, PMessage, IResult>,
                         stream: ChildProcessReadableStream,
                         line: string) {
            let hasHandler: boolean = false
            entries.forEach((entry) => {
                if(entry.streams === null || entry.streams.indexOf(stream) >= 0) {
                    const match = entry.matcher(line)
                    if(match !== null) {
                        entry.handler.call(this, context, match, stream)
                        hasHandler = true
                    }
                }
            })

            // Call fallbackHandler if none of the handlers could handle the provides line.
            if(!hasHandler && fallbackHandler) {
                fallbackHandler.call(this, context, stream, line)
            }
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- Convenience Getters ----------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    get length(): number {
        return this.entries.length
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INTERPRET MATCHER ------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected getMatcherFunction(matcher: LineMatcherDefinition): LineMatcherFunction {

        if (typeof matcher === 'string') {
            if(this.neverParseStringToRegex) {
                return this.getStringMatcherFunction(matcher)
            }

            try {
                return this.getRegexMatcherFunction(RegExp(matcher))
            } catch (e) {
                return this.getStringMatcherFunction(matcher)
            }
        }

        if (matcher instanceof RegExp) {
            return this.getRegexMatcherFunction(matcher)
        }

        return matcher
    }

    protected getStringMatcherFunction(matcher: string): LineMatcherFunction {
        return (line: string) => {
            if (line.includes(matcher)) {
                return {
                    line,
                    match: matcher,
                    parts: [],
                    groups: {},
                }
            } else {
                return null
            }
        }
    }

    protected getRegexMatcherFunction(matcher: RegExp): LineMatcherFunction {
        return (line: string) => {
            const result = matcher.exec(line)

            if(result === null) {
                return null
            }

            return {
                line,
                match: result[0],
                parts: result.slice(1),
                groups: result.groups || {},
            }
        }
    }

}
