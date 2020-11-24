import * as path from "path"
import PkgBuilder from '../../../src/build/PkgBuilder'

describe('Build a command', () => {

    const commandTable: [string][] = [
        [path.resolve(__dirname, 'commands/simple-command.command.ts')]
    ]
    const outPath: string = path.resolve(__dirname, '../../../testFiles/feature/build')

    describe.each(commandTable)('Build Command at %s', (path) => {
        test('Can build', async () => {
            const builder = new PkgBuilder(path, {
                output: {
                    path: outPath
                },
                module: {
                    rules: [
                        {
                            test: /\.tsx?$/,
                            loader: 'ts-loader',
                            options: {
                                transpileOnly: true,
                                logInfoToStdOut: true,
                                compilerOptions: {
                                    rootDir: './'
                                }
                            },
                        }
                    ]
                }
            })

            const stats = await builder.run()
            console.log(stats)
        }, 100000)
    })

})
