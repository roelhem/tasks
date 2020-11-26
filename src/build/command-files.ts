import * as fs from 'fs'
import * as path from 'path'
import {CommandFile, CommandFileType} from './types'

export const COMMAND_FILENAME_REGEX: RegExp = /^(?<name>[A-Za-z_][0-9A-Za-z\-_]*)\.command\.(?<type>js|ts)x?$/

/**
 * Returns a list of command files in a specific directory.
 *
 * @param commandDir Path to the directory of which you want to retrieve the command files. Defaults to '.'.
 * @param regexp The regexp used to match command files. This regex should have a `name` and `type` group to signal the
 *               name of the command and the type.
 */
export async function getCommandFiles(
    commandDir: string = '.',
    regexp: RegExp = COMMAND_FILENAME_REGEX
): Promise<CommandFile[]> {
    // Get the dirPath and the dir.
    const dirPath = path.resolve(commandDir)
    const dir = await fs.promises.opendir(dirPath)

    // Initialize the result
    const result: CommandFile[] = []

    // Loop trough all dir entries.
    for await (const dirent of dir) {
        // Only look at file entries.
        if(dirent.isFile()) {
            // execute the regexp.
            const match = regexp.exec(dirent.name)
            // Add matched files to the result
            if(match && match.groups) {
                const name = match.groups.name as string
                const type = match.groups.type as CommandFileType
                result.push({name, type, path: path.join(dirPath, dirent.name)})
            }
        }
    }

    // Return the result
    return result
}

export async function getCommandFile(
    input: string,
    commandDir?: string,
    regexp?: RegExp,
    preferType: CommandFileType = 'js'
): Promise<CommandFile> {
    // Check if the provided command is a command file.
    const fromFilePath = await getCommandFileFromPath(input)
    if(fromFilePath !== null) { return fromFilePath }

    // Check if the provided command is a command file relative to the commandDir.
    if(commandDir) {
        const fromRelativePath = await getCommandFileFromPath(path.join(commandDir, input))
        if(fromRelativePath !== null) { return fromRelativePath }
    }

    // Get the commands as a command name.
    const commands = (await getCommandFiles(commandDir, regexp)).filter(f => f.name === input)
    if(commands.length <= 0) {
        throw new Error(`Can't find command from '${input}'${commandDir ? ` in directory '${commandDir}'` : ''}'.`)
    } else if(commands.length === 1) {
        return commands[0]
    } else {
        const preferred = commands.find(f => f.type === preferType)
        return preferred || commands[0]
    }
}

/**
 * Returns a commandFile based on the provided path.
 *
 * @param input The path to a commandFile.
 */
async function getCommandFileFromPath(input: string): Promise<CommandFile|null> {
    try {
        const stats = await fs.promises.stat(input)
        if(stats.isFile()) {
    return pathToCommandFile(input)
} else {
    return null
}
} catch (e) {
    return null
}
}

/**
 * Returns the [[CommandFileType]] of a file based on it's path or extension.
 *
 * @param input A file path or extension.
 */
export function getCommandFileType(input: string): CommandFileType {
    // Get the extensions
    let ext = path.extname(input)
    if(ext === '') { ext = input }
    if(ext.startsWith('.')) { ext = ext.slice(1) }

    // Test the extension
    if(ext.startsWith('ts')) {
        return 'ts'
    } else if(ext.startsWith('js')) {
        return 'js'
    } else {
        throw new Error(`FilePath has an unknown extension '${ext}'.`)
    }
}

/**
 * Converts a string containing a path to a [[CommandFile]] instance.
 *
 * @param input The input string.
 */
export function pathToCommandFile(input: string): CommandFile {
    return {
        type: getCommandFileType(input),
        name: input.split('.')[0],
        path: path.resolve(input),
    }
}
