import * as webpack from 'webpack'
import {Compiler, Configuration, Stats, ProgressPlugin, RuleSetRule} from 'webpack'
import PkgPlugin, {Options as PkgPluginOptions} from './PkgPlugin'
import * as path from 'path'
import * as crypto from 'crypto'
import {merge} from 'webpack-merge'
import {CommandFile, CommandFileType} from './types'
import {getCommandFile, getCommandFileType, pathToCommandFile} from './command-files'
import * as os from 'os'
import {CommandProvider, NamedTaskProvider, TaskProvider} from '../types'
import TaskContext from '../utils/TaskContext'

/**
 * Options for the [[PkgBuilder]].
 */
export interface Options extends PkgPluginOptions {
    /**
     * Path to a folder in which the temporary files are stored during the build process.
     */
    buildPath?: string
    /**
     * Additional webpack options. Can overwrite the generated options.
     */
    webpack?: Configuration
    /**
     * The name of the executable that you want to build.
     */
    name?: string
    /**
     * Whether or not `ts-loader` should be used in webpack.
     *
     * This value defaults to `true` if the [[CommandFile]] has type `ts`, otherwise it defaults to `true`.
     */
    tsLoader?: boolean|RuleSetRule
    /**
     * Just resume when some stat-errors occurred.
     */
    ignoreStatErrors?: boolean
}

/**
 * Class that abstracts the creation of an stand-alone executable from a command file. It uses `webpack` and `pkg` on
 * the background.
 */
export default class PkgBuilder implements NamedTaskProvider<Stats, [], string> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATIC METHODS ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Returns a new [[PkgBuilder]] for the provided command.
     *
     * @param command The name of the command that you want to build or a path to a command file.
     * @param options The options for the [[PkgBuilder]].
     */
    static async get(command: string, options: Options & {
        commandDir?: string
        preferType?: CommandFileType
        commandFileRegex?: RegExp
    } = {}): Promise<PkgBuilder> {
        const commandFile = await getCommandFile(
            command,
            options.commandDir,
            options.commandFileRegex,
            options.preferType
        )
        return new PkgBuilder(commandFile, options)
    }

    /**
     * Builds a command pkg-executable.
     *
     * This function essentially just calls [[get]] and then [[PkgBuilder.run]] on the result.
     *
     * @param command The name of the command that you want to build or a path to a command file.
     * @param options The options for the [[PkgBuilder]].
     */
    static build(command: string, options?: Options & {
        commandDir?: string
        preferType?: CommandFileType
        commandFileRegex?: RegExp
    }): Promise<Stats> {
        return this.get(command, options).then(builder => builder.run())
    }

    /**
     * A task that builds a command pkg-executable.
     *
     * This task will find the [[PkgBuilder]] using [[get]] and then runs it as a task.
     *
     * @param buildOptions Default options for the build-task you want to create.
     */
    static buildTask(buildOptions: Options & {
        commandDir?: string
        preferType?: CommandFileType
        commandFileRegex?: RegExp
    } = {}): TaskProvider<Stats, [string, Options?]> {
        return {
            async task(context, command, options = {}) {
                // Getting the builder
                context.setProgressTotal(100, 'Finding Command File...')
                const builder = await PkgBuilder.get(command, merge(buildOptions, options))
                context.setProgress(1, undefined, 'Building Command File...')
                const stats = await context.runSubTask([1, 100], builder)
                if(stats.hasErrors()) {
                    throw new Error(`Builder exited with an error.`)
                }
                return stats
            },
        }
    }

    static buildCommand(buildOptions: Options & {
        commandDir?: string
        preferType?: CommandFileType
        commandFileRegex?: RegExp
    } = {}): CommandProvider<Stats, {
        verbosity?: number
        command?: string
        preferType?: string
        commandDir?: string
        output?: string
        outputPath?: string
    }> {
        return {
            command: 'build <command>',
            description: 'Builds a command-pkg from a command-file.',
            build: yargs => yargs
                .positional('command', {
                    describe: 'The name of a command or path to command-file that you want to build.',
                    type: 'string',
                })
                .option('commandDir', {
                    alias: ['d', 'dir', 'sourceDir'],
                    describe: 'Path to the directory that contains all the commands.',
                    default: '.',
                    type: 'string',
                })
                .option('preferType', {
                    alias: ['t', 'prefer'],
                    describe: `The preferred type of build command of more than one is found.`,
                    default: buildOptions.preferType || 'js',
                    type: 'string',
                    choices: ['ts', 'js'],
                })
                .option('output', {
                    alias: ['o', 'out'],
                    describe: 'Filename (or path) for the resulting executable.',
                    type: 'string',
                })
                .option('outputPath', {
                    alias: ['outPath'],
                    describe: 'The directory in which you want to store the output.',
                    type: 'string',
                })
                .option('verbosity', {
                    alias: ['v'],
                    describe: 'The verbosity of the command.',
                    type: 'count',
                }),
            task: async(context, args): Promise<Stats> => {
                // Ensure command is set.
                if(args.command === undefined) {
                    throw new Error(`No command provided.`)
                }
                // Set the progress total
                context.setProgressTotal(100)
                // Run the build task.
                const stats = await context.runSubTask(
                    [0, 100],
                    this.buildTask(merge(buildOptions, {
                        commandDir: args.commandDir,
                        preferType: args.preferType ? getCommandFileType(args.preferType) : undefined,
                        output: args.output,
                        outputPath: args.outputPath,
                    })),
                    args.command as string
                )

                // Log the stats
                if(args.verbosity !== undefined && args.verbosity > 0) {
                    console.log(stats.toString({ colors: true }))
                }

                // return the stats
                return stats
            },
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATIC HELPER METHODS --------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Returns the default folder that can be used to build the package.
     *
     * @param commandFile The command file that will be build, used to generate the build-folder name.
     * @param name The name of the command that you want to build, used to generate the build-folder name.
     */
    protected static getDefaultBuildPath(commandFile?: CommandFile, name?: string): string {
        const hash = crypto.createHash('sha256')
        hash.write(commandFile ? commandFile.path : crypto.randomBytes(4))
        if(name) {
            hash.write(name)
        }
        const folderName = hash.digest().toString('base64').replace(/\//g, '_')
        return path.join(os.tmpdir(), 'roelhem-tasks-package', 'pkg-builder', folderName)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * The command file from which the new executable is created.
     */
    commandFile: CommandFile

    /**
     * A temporary folder that can be used to build the executable.
     */
    buildPath: string
    name: string
    readonly configuration: Configuration
    pkgPlugin: PkgPlugin

    /**
     * Whether or not the errors from the resulting stat can be ignored.
     */
    ignoreStatErrors: boolean

    constructor(source: string|CommandFile, options: Options = {}) {
        // Store the commands
        this.commandFile = typeof source === 'string' ? pathToCommandFile(source) : source
        this.name = options.name || (options.output ? path.basename(options.output) : this.commandFile.name)

        // Control flow options
        this.ignoreStatErrors = !!options.ignoreStatErrors

        // Get the build path.
        this.buildPath = path.resolve(options.buildPath || PkgBuilder.getDefaultBuildPath(this.commandFile, this.name))

        // Create the pkg plugin.
        this.pkgPlugin = new PkgPlugin({
            output: this.name,
            ...options,
        })

        // Get the bin path
        const binPath = path.join(__dirname, 'bin.js')

        // determine if tsLoader should be used.
        const useTsLoader = options.tsLoader === undefined ? this.commandFile.type === 'ts' : options.tsLoader

        // Construct the configuration.
        this.configuration = merge({
            mode: options.debugMode ? 'development' : 'production',
            target: 'node',
            output: {
                path: this.buildPath,
            },
            entry: {
                [this.name]: binPath,
            },
            plugins: [
                this.pkgPlugin,
            ],
            resolve: {
                alias: {
                    '__command_input': this.commandFile.path,
                },
            },
            module: {
                rules: useTsLoader ? [merge({
                    test: /\.tsx?$/,
                    loader: 'ts-loader',
                    options: {
                        logInfoToStdOut: true,
                    },
                }, typeof options.tsLoader === 'object' ? options.tsLoader : {})] : [],
            },
        }, options.webpack || {})
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIATING THE COMPILER ------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    private _compiler?: Compiler
    get compiler(): Compiler {
        if(!this._compiler) {
            this._compiler = webpack(this.configuration)
        }
        return this._compiler
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- RUN METHOD -------------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    /**
     * Call this method to build the package without keeping track of it's progress.
     */
    run(): Promise<Stats> {
        return new Promise<Stats>((resolve, reject) => {
            this.compiler.run((error, stats) => {
                if(error) {
                    reject(error)
                } else if (!this.ignoreStatErrors && stats && stats.hasErrors()) {
                    console.error(stats.toString({ colors: true }))
                    reject(new Error(`PkgBuilder had some errors.`))
                } else {
                    resolve(stats)
                }
            })
        })
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENTING: NamedTaskProvider<Stats, [], string> ---------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    task(context: TaskContext<Stats, [], string, any>): Promise<Stats> {
        const progressPrefix = `PKG[${this.name}]`
        context.setProgressTotal(1, `${progressPrefix}: initializing...`)

        // Creating the compiler with the progress plugin.
        const compiler = webpack(merge({
            plugins: [
                new ProgressPlugin((percentage, verb, info) => {
                    // Set the progress
                    const message = verb.trim() !== ''
                        ? `${progressPrefix}: ${verb}${info ? ` ${info}` : ''}...`
                        : progressPrefix
                    context.setProgress(percentage, undefined, message)
                }),
            ],
        }, this.configuration))

        // Returning the progress promise.
        return new Promise<Stats>((resolve, reject) => {
            compiler.run((error, stats) => {
                if(error) {
                    reject(error)
                } else if (stats && stats.hasErrors()) {
                    console.error(stats.toString({ colors: true }))
                    reject(new Error(`PkgBuilder had some errors.`))
                } else {
                    resolve(stats)
                }
            })
        })
    }

    get taskName(): string {
        return `PkgBuilder[${this.name}]`
    }

}
