import {WebpackPluginInstance, Compiler} from 'webpack'
import * as path from 'path'
import {unlink, writeFile} from 'fs'
import {exec} from 'pkg'
import {BuildArch, BuildNodeRange, BuildPlatform, BuildTarget, BuildTargetOptions} from './types'
import {arch} from 'os'

export interface Options extends BuildTargetOptions {
    targets?: BuildTarget|BuildTarget[]
    output?: string
    outputPath?: string
    debugMode?: boolean
    buildBaseBinaries?: boolean
    pkConfigFilename?: string
    assets?: string|string[]
    scripts?: string|string[]
}

export default class PgkPlugin implements WebpackPluginInstance {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- STATIC HELPER METHODS --------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    static getBuildPlatform(platform: NodeJS.Platform|BuildPlatform = process.platform): BuildPlatform {
        switch (platform) {
            case 'win':
            case 'win32': return 'win'
            case 'macos':
            case 'darwin': return 'macos'
            case 'alpine': return 'alpine'
            case 'netbsd':
            case 'openbsd':
            case 'freebsd': return 'freebsd'
            case 'aix':
            case 'android':
            case 'cygwin':
            case 'sunos':
            case 'linux':
            default: return 'linux'
        }
    }

    static getArch(input?: string): BuildArch {
        switch (input || arch()) {
            case 'arm64':
            case '64':
            case 'x64': return 'x64'
            case 'armv6': return 'armv6'
            case 'armv7': return 'armv7'
            default: return 'x86'
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    targets: BuildTarget[]
    output: string
    outputPath: string
    assets: string[]
    scripts: string[]
    debugMode: boolean
    buildBaseBinaries: boolean

    pkgConfigFilename: string
    nodeRange: BuildNodeRange
    platform: BuildPlatform
    arch: BuildArch

    constructor(options: Options = {}) {
        this.targets = Array.isArray(options.targets) ? options.targets :
            options.targets !== undefined ? [options.targets] : []
        this.output = options.output || 'package'
        this.scripts = Array.isArray(options.scripts) ? options.scripts :
            options.scripts !== undefined ? [options.scripts] : []
        this.assets = Array.isArray(options.assets) ? options.assets :
            options.assets !== undefined ? [options.assets] : []
        this.outputPath = options.outputPath || './build'
        this.debugMode = !!options.debugMode
        this.buildBaseBinaries = !!options.buildBaseBinaries

        this.pkgConfigFilename = options.pkConfigFilename || 'pkg-config.json'

        this.nodeRange = options.nodeRange !== undefined ? options.nodeRange : 12
        this.platform = PgkPlugin.getBuildPlatform(options.platform)
        this.arch = PgkPlugin.getArch(options.arch)
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- TARGETS ----------------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    getTargetString(input: BuildTarget): string {
        if(typeof input === 'string') {
            return input
        } else {
            const nodeRange: number|'latest' = input.nodeRange !== undefined ? input.nodeRange : this.nodeRange
            const platform = input.platform ? PgkPlugin.getBuildPlatform(input.platform) : this.platform
            const arch = input.arch ? PgkPlugin.getArch(input.arch) : this.arch
            return `node${nodeRange}-${platform}-${arch}`
        }
    }

    get targetStrings(): string[] {
        const targets = this.targets.length > 0 ? this.targets : ['host']
        return targets.map(target => this.getTargetString(target))
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- PKG CONFIG FILE --------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    protected getPkgConfigFilePath(outputPath?: string) {
        outputPath = outputPath || this.outputPath
        return path.join(outputPath, this.pkgConfigFilename)
    }

    protected writePkgConfigFile(outputPath?: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            writeFile(this.getPkgConfigFilePath(outputPath), JSON.stringify({
                targets: this.targetStrings,
                assets: this.assets,
                scripts: this.scripts,
            }, undefined, 2), (err) => {
                if(err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
    }

    protected unlinkPkgConfigFile(outputPath?: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            unlink(this.getPkgConfigFilePath(outputPath), (err) => {
                if(err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- BUILD ------------------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    async build(sourcePath: string, outputPath?: string) {
        outputPath = outputPath || this.outputPath
        const args: string[] = [sourcePath]

        // Add the dist path
        args.push('--out-path', path.join(outputPath, this.output))

        // Config
        const createConfigFile = this.assets.length || this.scripts.length
        if(createConfigFile) {
            await this.writePkgConfigFile(outputPath)
            args.push('--config', this.getPkgConfigFilePath(outputPath))
        } else {
            args.push('--targets', this.targetStrings.join(','))
        }

        // Debug mode
        if(this.debugMode) {
            args.push('--debug')
        }

        // Build mode
        if(this.buildBaseBinaries) {
            args.push('--build')
        }

        // Run the build
        try {
            await exec(args)
        } catch (e) {
            throw e
        } finally {
            if(createConfigFile) {
                await this.unlinkPkgConfigFile(outputPath)
            }
        }
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENT: WebpackPluginInstance ---------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    apply(compiler: Compiler) {
        compiler.hooks.afterEmit.tapAsync(`PkgPlugin`, async (compilation, callback) => {
            const outputPath = compilation.compiler.options.output.path || this.outputPath

            // Get a list of files that should be added
            const entries = Object.keys(compilation.compiler.options.entry)
            const files = Object.keys(compilation.assets)
                .filter((_, index) => index < entries.length)

            // Loop through files and build them.
            for (const file of files) {
                const filePath = path.join(outputPath, file)
                await this.build(filePath, outputPath)
            }

            // Callback to signal that the plugin had been run successfully
            callback()
        })
    }
}
