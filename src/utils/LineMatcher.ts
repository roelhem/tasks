import ChildProcessTaskTemplate, {
    ChildProcessReadableStream, ChildProcessTaskContext, LineHandler,
    ProcessOptions,
    Result
} from '../templates/ChildProcessTaskTemplate'
import {ArgArray, argAsArray} from './arguments'

export interface LineMatch {
    line: string
    match: string
    parts: string[]
    groups: {[key: string]: string}
}

export type LineMatcherFunction = (line: string) => LineMatch|null
export type LineMatcherDefinition = string|RegExp|LineMatcherFunction

export type LineMatcherHandler<
    PResult extends Result = Result,
    POptions extends ProcessOptions = ProcessOptions,
    PMessage = string,
    IResult = any
    > = (this: ChildProcessTaskTemplate<PResult, POptions, PMessage, IResult>,
         context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
         match: LineMatch, stream: ChildProcessReadableStream) => void

export interface LineMatcherEntry<
    PResult extends Result = Result,
    POptions extends ProcessOptions = ProcessOptions,
    PMessage = string,
    IResult = any
    > {
    matcher: LineMatcherFunction,
    streams: null|ChildProcessReadableStream[]
    handler: LineMatcherHandler<PResult, POptions, PMessage, IResult>
}

export interface Options {
    neverParseStringToRegex?: boolean
}

export class LineMatcher<
    PResult extends Result = Result,
    POptions extends ProcessOptions = ProcessOptions,
    PMessage = string,
    IResult = any
    > {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected entries: LineMatcherEntry<PResult, POptions, PMessage, IResult>[]

    readonly neverParseStringToRegex: boolean

    constructor(options: Options = {}) {
        this.entries = []
        this.neverParseStringToRegex = !!options.neverParseStringToRegex
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- MANAGE ENTRIES ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    add(matcher: LineMatcherDefinition,
        handler?: LineMatcherHandler<PResult, POptions, PMessage, IResult>,
        streams?: ArgArray<ChildProcessReadableStream>): LineMatcherEntry<PResult, POptions, PMessage, IResult> {
        const result: LineMatcherEntry<PResult, POptions, PMessage, IResult> = {
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

    get lineHandler(): LineHandler<PResult, POptions, PMessage, IResult> {
        const entries = this.entries
        return function (context: ChildProcessTaskContext<PResult, POptions, PMessage, IResult>,
                         stream: ChildProcessReadableStream,
                         line: string) {
            entries.forEach((entry) => {
                if(entry.streams === null || entry.streams.indexOf(stream) >= 0) {
                    const match = entry.matcher(line)
                    if(match !== null) {
                        entry.handler.call(this, context, match, stream)
                    }
                }
            })
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
            const result = line.match(matcher)

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
