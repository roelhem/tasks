import task, {SpawnProcessTaskTemplate} from '../../src'
import {SendHandle, Serializable} from 'child_process'
import {WritableManager} from '../../src/templates/WritableManager'
import {Hooks} from '../../src/templates/ChildProcessTaskTemplate'
import {LineMatcher} from '../../src/utils'
import fn = jest.fn

function createMockHooks(name: string = '', log: boolean = false): Hooks {
    const prefix = name ? `${name}:` : ''
    return {
        onClose: jest.fn((code: number, signal: NodeJS.Signals) => {
            if(log) { console.log(prefix, 'CLOSE', code, signal) }
        }),
        onDisconnect: jest.fn(() => {
            if(log) { console.log(prefix, 'DISCONNECT') }
        }),
        onError: jest.fn((error: Error) => {
            if(log) { console.log(prefix, 'ERROR', error) }
        }),
        onExit: jest.fn((code: number|null, signal: NodeJS.Signals|null) => {
            if(log) { console.log(prefix, 'EXIT', code, signal) }
        }),
        onMessage: jest.fn((message: Serializable, sendHandle: SendHandle) => {
            if(log) { console.log(prefix, 'MESSAGE', message, sendHandle) }
        }),
        onData: jest.fn((stream: string, chunk: string|Buffer) => {
            if(log) { console.log(prefix, `GOT DATA FROM '${stream}': `, chunk) }
        }),
        onLine: jest.fn((stream: string, line: string) => {
            if(log) { console.log(prefix, `GOT A LINE FROM '${stream}': `, line) }
        }),
        onSendAvailable: jest.fn((stream: string, send: WritableManager) => {
            if(log) { console.log(prefix, `SEND AVAILABLE FROM '${stream}': `, send) }
        })
    }
}

describe('Usage with Spawn - ChildProcesses', () => {

    test('Echo a string', async () => {
        const echo = SpawnProcessTaskTemplate.create('echo')
        const a = new echo({ prefixArgs: ['prefixArg'] })

        const hooks = createMockHooks('Echo Task')

        await task.run(a, {
            args: ['\nargFromTask', '\nlastArg']
        }, hooks)

        expect(hooks.onLine).toBeCalledWith('stdout', 'prefixArg ')
        expect(hooks.onLine).toBeCalledWith('stdout', 'argFromTask ')
        expect(hooks.onLine).toBeCalledWith('stdout', 'lastArg')
    })

    test('With line matcher', async () => {
        const echo = SpawnProcessTaskTemplate.create('echo')

        // Creating the matcher
        const lineMatcher = new LineMatcher()
        const startsWithA = fn(() => { return })
        lineMatcher.add(/^A/, startsWithA)
        const endsWithA = fn(() => { return })
        lineMatcher.add(/A$/, endsWithA)
        const containsE = fn(() => { return })
        lineMatcher.add(/E/, containsE)

        const a = new echo({ lineHandlers: lineMatcher })

        await task.run(a, {
            args: ['Ab\nAc\nD\nA\ndA']
        })

        expect(startsWithA).toBeCalledTimes(3)
        expect(endsWithA).toBeCalledTimes(2)
        expect(containsE).toBeCalledTimes(0)
    })

    test('Get node version', async () => {
        const node = SpawnProcessTaskTemplate.create('node')
        const a = new node({ prefixArgs: ['--version'], inheritEnv: true })
        const hooks = createMockHooks()
        await task.run(a, {}, hooks)

        expect(hooks.onLine).toBeCalled()
    })

    test('Environment variables', async () => {
        const lines: string[] = []
        const handleLine = jest.fn((context, stream, line) => {
            lines.push(line)
        })
        const nodeExecute = SpawnProcessTaskTemplate.create('node', {})
        const a = new nodeExecute({
            inheritEnv: false,
            extraEnv: { PATH: process.env.PATH, TEST_ENV_A: 'A', TEST_ENV_B: undefined },
            prefixArgs: ['-e'],
            lineHandlers: handleLine
        })
        const code = `
            Object.entries(process.env).forEach(function (value) {
                console.log(value[0] + ': ' + value[1])
            })
        `
        await task.run(a, { args: [code]})

        expect(handleLine).toBeCalled()
        expect(lines).toContain(`PATH: ${process.env.PATH}`)
        expect(lines).toContain(`TEST_ENV_A: A`)
    })

    test('Arguments', async () => {
        const lines: string[] = []
        const handleLine = jest.fn((context, stream, line) => {
            lines.push(line)
        })
        const nodeExecute = SpawnProcessTaskTemplate.create('node', {})
        const a = new nodeExecute({
            inheritEnv: false,
            extraEnv: { PATH: process.env.PATH, TEST_ENV_A: 'A', TEST_ENV_B: undefined },
            prefixArgs: ['-e'],
            lineHandlers: handleLine
        })
        const code = `
            process.argv.forEach(function (value) {
                console.log(value)
            })
        `
        await task.run(a, { args: [code, 'a', 'abc cde', '3']})

        expect(handleLine).toBeCalled()
        expect(lines).toContain('a')
        expect(lines).toContain('abc cde')
        expect(lines).toContain('3')
    })
})
