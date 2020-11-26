import * as path from "path"
import PkgBuilder from '../../../src/build/PkgBuilder'
import task from '../../../src'

describe('Build a command', () => {

    const commandTable: [string][] = [
        ['simple-command'],
        ['empty-command'],
        ['default-export']
    ]

    const commandDir = path.resolve(__dirname, 'commands')
    const outputPath = path.resolve(__dirname, '../../../testFiles')

    describe.each(commandTable)('Build Command "%s".', (command) => {
        test('Using build method.', async () => {
            const stats = await PkgBuilder.build(command, {
                commandDir,
                outputPath: path.join(outputPath, 'build-method', command),
                tsLoader: {options: {compilerOptions: {rootDir: './'}}},
            })
            console.log(stats)
        }, 100000)

        test('Using PkgBuilder as a task', async () => {
            await task.run(await PkgBuilder.get(command, {
                commandDir,
                outputPath: path.join(outputPath, 'task', command),
                tsLoader: {options: {compilerOptions: {rootDir: './'}}},
            })).on('progressUpdate', (current, total, message) => {
                process.stdout.write(`[${current}/${total}] ${message}\n`)
            })
        }, 100000)

        test('Using PkgBuilder build task', async () => {
            const t = PkgBuilder.buildTask({ commandDir })
            await task.run(t, command, {
                outputPath: path.join(outputPath, 'build-task', command),
                tsLoader: {options: {compilerOptions: {rootDir: './'}}},
            }).on('progressUpdate', (current, total, message) => {
                process.stdout.write(`[${current}/${total}] ${message}\n`)
            })
        }, 100000)
    })

})
