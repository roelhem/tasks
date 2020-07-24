import task, {SpawnProcessTaskTemplate} from '../../src'
import {WritableManager} from '../../src/utils'
import {Hooks} from '../../src/templates/ChildProcessTaskTemplate'
import {LineMatcher} from '../../src/utils'

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
        onMessage: jest.fn((message: any, sendHandle: any) => {
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
        }),
    }
}

describe('Usage with Spawn - ChildProcesses', () => {

    const echo = SpawnProcessTaskTemplate.create('echo')
    const node = SpawnProcessTaskTemplate.create(process.execPath)

    test('Echo a string', async () => {
        const a = new echo({ prefixArgs: ['prefixArg'] })

        const hooks = createMockHooks('Echo Task')

        await task.run(a, {
            args: ['\nargFromTask', '\nlastArg'],
        }, hooks)

        expect(hooks.onLine).toBeCalledWith('stdout', 'prefixArg ')
        expect(hooks.onLine).toBeCalledWith('stdout', 'argFromTask ')
        expect(hooks.onLine).toBeCalledWith('stdout', 'lastArg')
    })

    test('With line matcher', async () => {
        // Creating the matcher
        const lineMatcher = new LineMatcher()
        const startsWithA = jest.fn(() => { return })
        lineMatcher.add(/^A/, startsWithA)
        const endsWithA = jest.fn(() => { return })
        lineMatcher.add(/A$/, endsWithA)
        const containsE = jest.fn(() => { return })
        lineMatcher.add(/E/, containsE)

        const a = new echo({ lineHandlers: lineMatcher })

        await task.run(a, {
            args: ['Ab\nAc\nD\nA\ndA'],
        })

        expect(startsWithA).toBeCalledTimes(3)
        expect(endsWithA).toBeCalledTimes(2)
        expect(containsE).toBeCalledTimes(0)
    })

    test('Get node version', async () => {
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
        const a = new node({
            inheritEnv: false,
            extraEnv: { PATH: process.env.PATH, TEST_ENV_A: 'A', TEST_ENV_B: undefined },
            prefixArgs: ['-e'],
            lineHandlers: handleLine,
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
        const a = new node({
            prefixArgs: ['-e'],
            lineHandlers: handleLine,
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

    test.skip('Env inheritance', async () => {
        const lineMatcher = new LineMatcher<NodeJS.ProcessEnv>()
        lineMatcher.add(/^(?<key>[a-zA-Z0-9_]]+): (?<value>.*)/, (context, match) => {
            const key = match.groups.key as string
            const value = match.groups.value as string
            context.setData(key, value)
        })

        const nodeExecute = new node({
            prefixArgs: ['-e'],
            extraEnv: {MY_A: 'a', MY_C:'0'},
            lineHandlers: lineMatcher,
        })
        const code = `
            Object.entries(process.env).forEach(function (value) {
                console.log(value[0] + ': ' + value[1])
            })
        `

        const result = await task.run(nodeExecute, { args: [code], env: {MY_B:'b', MY_C:'c'} })
        expect(result.data).toEqual({...process.env, MY_A: 'a', MY_B: 'b', MY_C:'c'})
    })

    test('Tracking the progress', async () => {
        const lineMatcher = new LineMatcher()
        lineMatcher.add(/^total (?<totalProgress>[0-9]+)/, (context, match) => {
            const totalProgress = parseInt(match.groups.totalProgress, 10)
            context.setProgressTotal(totalProgress)
        })
        lineMatcher.add(/^(?<progress>[0-9]+)(?: (?<message>.*))?$/, (context, match) => {
            const progress = parseInt(match.groups.progress, 10)
            const message  = typeof match.groups.message === 'string' ? match.groups.message.trim() : ''
            if(message === '') {
                context.setProgress(progress)
            } else {
                context.setProgress(progress, undefined, message)
            }
        })

        const progressUpdate = jest.fn((_p, _t, _m) => { return })
        const lines = ['first line', '1', 'total 10', '3', 'Some string', '4 A', '5', '9 B', '10 D', 'We are done!']
        const t = task.run(new echo({ lineHandlers: lineMatcher }), { args: [lines.join('\n')] })
        t.on('progressUpdate', progressUpdate)
        await t

        expect(progressUpdate).toBeCalled()
        expect(progressUpdate).toBeCalledWith(1, undefined, undefined)
        expect(progressUpdate).toBeCalledWith(1, 10, undefined)
        expect(progressUpdate).toBeCalledWith(3, 10, undefined)
        expect(progressUpdate).toBeCalledWith(4, 10, 'A')
        expect(progressUpdate).toBeCalledWith(5, 10, 'A')
        expect(progressUpdate).toBeCalledWith(9, 10, 'B')
        expect(progressUpdate).toBeCalledWith(10, 10, 'D')
    })

    test('Setting result data from the lines', async () => {
        const lineMatcher = new LineMatcher<{a: number, b:number, lastB: string}>()
        lineMatcher.add(/^A$/, (context) => {
            context.setData('a', (context.getData('a') || 0) + 1)
        })
        lineMatcher.add(/^B/, (context, match) => {
            context.setData({
                b: (context.getData().b || 0) + 1,
                lastB: match.line,
            })
        })

        const echoWithData = SpawnProcessTaskTemplate.create<{a: number, b:number, lastB: string}>('echo')
        const template = new echoWithData({ lineHandlers: lineMatcher })

        const a = await task.run(template, { args: ['A\n\nA\nC'] })
        expect(a.data).toEqual({a: 2})

        const b = await task.run(template, { args: ['A\nB\nBla\nC'] })
        expect(b.data).toEqual({a: 1, b: 2, lastB: 'Bla'})

        const c = await task.run(template, {})
        expect(c.data).toEqual({})
    })
})
