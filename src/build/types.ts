// -------------------------------------------------------------------------------------------------------------- //
//   CommandFiles                                                                                                 //
// -------------------------------------------------------------------------------------------------------------- //

export type CommandFileType = 'js'|'ts'

/**
 * Expended info of a command file.
 */
export interface CommandFile {
    /**
     * The name of the command that the command file describes.
     */
    name: string
    /**
     * The absolute path to the command file.
     */
    path: string
    /**
     * The type of the command file.
     */
    type: CommandFileType
}

// -------------------------------------------------------------------------------------------------------------- //
//   Options for pkg                                                                                              //
// -------------------------------------------------------------------------------------------------------------- //

export interface PkgOptions {
    scripts?: string|string[]
    assets?: string|string[]
}

export type BuildPlatform = 'freebsd'|'linux'|'alpine'|'macos'|'win'
export type BuildArch = 'x64'|'x86'|'armv6'|'armv7'
export type BuildNodeRange = number|'latest'

export interface BuildTargetOptions {
    nodeRange?: BuildNodeRange
    platform?: NodeJS.Platform|BuildPlatform
    arch?: BuildArch
}

export type BuildTarget = string|BuildTargetOptions
