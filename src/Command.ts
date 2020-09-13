import {Task} from './Task'
import {Arguments, CommandModule, CommandBuilder, Options} from 'yargs'
import * as yargs from 'yargs'
import {CommandDescription, CommandExitOptions, CommandExitState, CommandProvider} from './types'

export default class Command<
    CResult = any,
    CArgs extends {} = {},
    GArgs extends {} = {},
    PMessage = any,
    IResult = any
> extends Task<CResult, [Arguments<CArgs & GArgs>], PMessage, IResult>
implements CommandProvider<CResult, CArgs, GArgs, PMessage, IResult>, CommandModule<GArgs, CArgs & GArgs> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    command: string
    aliases: readonly string[]
    description?: string
    build: CommandBuilder<GArgs, CArgs & GArgs> | { [p: string]: Options }
    hidden: boolean
    skipCleanup: boolean
    exit: CommandExitOptions

    constructor(description: CommandDescription<CResult, CArgs, GArgs, PMessage, IResult>)
    constructor(command: string, description: CommandDescription<CResult, CArgs, GArgs, PMessage, IResult>)
    constructor(arg0: string|CommandDescription<CResult, CArgs, GArgs, PMessage, IResult>,
                arg1?: CommandDescription<CResult, CArgs, GArgs>) {
        // Get the description
        const description: CommandDescription<CResult, CArgs, GArgs, PMessage, IResult>|undefined =
            typeof arg0 === 'string' ? arg1 : arg0
        if(description === undefined) {
            throw new TypeError(`No CommandDescription Provided.`)
        }

        // Set default description values
        description.command = typeof arg0 === 'string' ? arg0 : description.command || '$0'
        description.taskName = description.taskName || description.command.split(' ')[0]

        // Call super
        super(description)

        // Set the CommandOptions
        this.command = description.command
        this.aliases = typeof description.aliases === 'string' ? [description.aliases] : description.aliases || []
        this.description = description.description
        this.hidden = !!description.hidden
        this.build = description.build || {}
        this.skipCleanup = !!description.skipCleanup
        this.exit = description.exit === undefined ? true : description.exit
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENT: CommandModule<CArgs, GArgs> ---------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    get describe(): string | false | undefined {
        if(this.hidden) {
            return false
        } else {
            return this.description
        }
    }

    get handler(): (args: yargs.Arguments<CArgs & GArgs>) => void {
        return async args => {
            // Construct the task.

            // Run the task.
            let runError: Error & {exitCode?: number, isInterruptionError?: boolean}|undefined
            let result: CResult|undefined
            try {
                result = await this.run(args)
            } catch (error) {
                runError = error
            }

            // Run the cleanup
            if(!this.skipCleanup) {
                try {
                    await this.cleanup()
                } catch (e) {
                    if(e.isInterruptionError) {
                        return this.handleExit('cleanupInterrupted', e, result)
                    } else {
                        return this.handleExit('cleanupFailed', e, result)
                    }
                }
            }

            // Exit the process
            if(runError) {
                if(runError.isInterruptionError) {
                    return this.handleExit('interrupted', runError, result)
                } else {
                    return this.handleExit('failed', runError, result)
                }
            } else {
                return this.handleExit('succeeded', runError)
            }
        }
    }

    get builder(): CommandBuilder<GArgs, CArgs & GArgs> {
        return vargs => {
            if(typeof this.build === 'function') {
                return this.build(vargs)
            } else {
                return vargs.options(this.build) as any
            }
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- HELPER METHODS ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected handleExit(state: CommandExitState, error?: Error & {exitCode?: any}, result?: CResult) {
        // Do not do anything when exit is false.
        if(!this.exit) {
            return
        }

        // Call the handler when exit is a function.
        if(typeof this.exit === 'function') {
            return this.exit(error, state, result)
        }

        // Get the exit behaviour
        const exitBehaviour = typeof this.exit === 'object' ? this.exit[state] || true : true
        const exitCode = typeof exitBehaviour === 'number' ? exitBehaviour :
            error && typeof error.exitCode === 'number' ? error.exitCode :
                state === 'succeeded' ? 0 : 1

        // Exit with yargs when an error was given, exit with process.exit otherwise.
        if(error) {
            yargs.exit(exitCode, error)
        }
    }

}
