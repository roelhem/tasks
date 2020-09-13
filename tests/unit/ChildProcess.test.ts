import {ChildProcessType, Task, ChildProcess} from '../../src'

describe('ChildProcess', () => {

    const typeTable: [ChildProcessType][] = [
        ['exec'],
        ['execFile'],
        ['spawn'],
    ]

    describe.each(typeTable)(`Type "%s"`, (childProcessType) => {

        test('Initialisation', () => {
            const p = new ChildProcess('echo', {
                childProcessType
            })
            expect(p).toBeInstanceOf(Task)
            expect(p).toBeInstanceOf(ChildProcess)
        })

        test('Echo some lines', async () => {
            const p = new ChildProcess('echo', {
                prependArgs: ['a'],
                appendArgs: ['\nz'],
                childProcessType
            })
            const lineListener = jest.fn((line, stream) => {
                console.log(`RECEIVED LINE FROM STREAM ${stream}:`, line)
            })
            p.on('line', lineListener)
            await p.run('b', '\nc\nd')

            expect(lineListener).toBeCalledWith('a b ', 'stdout')
            expect(lineListener).toBeCalledWith('c', 'stdout')
            expect(lineListener).toBeCalledWith('d ', 'stdout')
            expect(lineListener).toBeCalledWith('z', 'stdout')
        })

        test('Interrupt a process', async () => {
            const p = new ChildProcess(process.execPath, {
                prependArgs: ['-e'],
                childProcessType,
            })
            const lineListener = jest.fn((line, stream) => {
                console.log(`RECEIVED LINE FROM STREAM ${stream}:`, line)
            })
            p.on('line', lineListener)
            p.run(`console.log('A');setTimeout(() => console.log('B'), 1000);`)

            await new Promise(resolve => setTimeout(resolve, 500))
            await p.interrupt()

            await expect(p).rejects.toThrow()

            expect(lineListener).toBeCalledWith('A', 'stdout')
            expect(lineListener).not.toBeCalledWith('B', 'stdout')
        })

        test('Throw Errors', async () => {
            const p = new ChildProcess(process.execPath, {
                prependArgs: ['-e'],
                childProcessType,
            })
            await expect(p.run(`throw new Error();`)).rejects.toThrow()
        })

        test('Receive errors', async () => {
            const p = new ChildProcess(process.execPath, {
                prependArgs: ['-e'],
                childProcessType,
                allowNonZeroExitCode: true,
            })
            const result = await p.run(`throw new Error();`)
            expect(result.exitCode).toBe(1)
        })

    })

    describe('Type "sudoExec"', () => {
        test('Echo with sudo', async () => {
            const p = new ChildProcess('echo', {
                childProcessType: 'sudoExec',
                processName: 'Allow This Prompt',
            })
            const result = await p.run('ABC')
            expect(result.exitCode).toBe(0)
        }, 60 * 1000)

        test('Denied Prompts', async () => {
            const p = new ChildProcess('echo', {
                childProcessType: 'sudoExec',
                processName: 'Deny This Prompt',
            })
            await expect(p.run('ABC')).rejects.toThrow()
        }, 60 * 1000)

        test('Throw Errors', async () => {
            const p = new ChildProcess(process.execPath, {
                prependArgs: ['-e'],
                processName: 'Allow This Prompt',
                childProcessType: 'sudoExec',
            })
            await expect(p.run(`throw new Error();`)).rejects.toThrow()
        }, 60 * 1000)

        test('Allow Thrown Error', async () => {
            const p = new ChildProcess(process.execPath, {
                prependArgs: ['-e'],
                processName: 'Allow This Prompt',
                childProcessType: 'sudoExec',
                allowNonZeroExitCode: true,
            })
            const result = await p.run(`throw new Error();`)
            console.log(result)
            expect(result.exitCode).not.toBe(0)
        }, 60 * 1000)

        test('Show all environment variables', async () => {
            const p = new ChildProcess(process.execPath, {
                childProcessType: 'sudoExec',
                prependArgs: ['-e'],
                processName: 'Allow This Prompt',
                env: {'A': 'HOI', 'B': 'false'}
            })
            const result = await p.run('console.log(JSON.stringify(process.env));')
            console.log(result)
            expect(result.stdout).not.toBe('string')
            expect(JSON.parse(result.stdout as string)).toMatchObject({
                'A': 'HOI',
                'B': 'false'
            })
        }, 60 * 1000)
    })

})
