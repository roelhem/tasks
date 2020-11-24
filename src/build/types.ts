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
