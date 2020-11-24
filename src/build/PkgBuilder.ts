import * as yargs from 'yargs'
import * as webpack from 'webpack'
import {Compiler, Configuration, Stats} from 'webpack'
import PkgPlugin, {Options as PgkPluginOptions} from './PkgPlugin'
import * as path from 'path'

export interface Options extends Omit<Configuration, 'entry'> {
    yargs?: yargs.Argv
    yargsSetup?: (yargs: yargs.Argv) => yargs.Argv
    pkg?: PgkPluginOptions
    name?: string
}

export default class PkgBuilder {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    compiler: Compiler
    commands: string
    name: string

    constructor(commands: string, options: Options = {}) {
        // Store the commands
        this.commands = commands
        // Get the name
        if(options.name) {
            this.name = options.name
        } else {
            this.name = path.basename(this.commands).split('.')[0]
        }
        const binPath = path.join(__dirname, 'bin.js')
        this.compiler = webpack({
            target: 'node',
            ...options,
            entry: {
                [this.name]: binPath,
            },
            plugins: [
                ...options.plugins || [],
                new PkgPlugin(options.pkg),
            ],
            resolve: {
                alias: {
                    '__command_input': this.commands,
                },
            },
        })
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- BUILD COMMANDS ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    run(): Promise<Stats> {
        return new Promise<Stats>((resolve, reject) => {
            this.compiler.run((error, stats) => {
                if(error) {
                    reject(error)
                } else if (stats && stats.hasErrors()) {
                    console.error(stats.toString({ colors:true }))
                    reject(new Error(`PkgBuilder had some errors.`))
                } else {
                    resolve(stats)
                }
            })
        })
    }

}
