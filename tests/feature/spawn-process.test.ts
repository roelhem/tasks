import task, {LineMatcher} from '../../src'

describe('Usage with Spawn - ChildProcesses', () => {

    test('Echo a string', async () => {
        const lineListener = jest.fn((line, stream) => console.log(`GOT LINE FROM ${stream}:`, line))

        await task.createChildProcess('echo', {
            prependArgs: ['prefixArg'],
        }).on('line', lineListener).run('\nargFromTask', '\nlastArg')

        expect(lineListener).toBeCalledWith('prefixArg ', 'stdout')
        expect(lineListener).toBeCalledWith('argFromTask ', 'stdout')
        expect(lineListener).toBeCalledWith('lastArg', 'stdout')
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

        await task.runChildProcess('echo', {
            lineHandlers: [lineMatcher]
        }, 'Ab\nAc\nD\nA\ndA')

        expect(startsWithA).toBeCalledTimes(3)
        expect(endsWithA).toBeCalledTimes(2)
        expect(containsE).toBeCalledTimes(0)
    })

    test('Get node version', async () => {
        const lineListener = jest.fn((line, stream) => console.log(`GOT LINE FROM ${stream}:`, line))

        await task.runChildProcess(process.execPath, {
            prependArgs: ['--version'],
            inheritEnv: true
        }, '\nargFromTask', '\nlastArg').on('line', lineListener)

        expect(lineListener).toBeCalled()
    })

    test('Environment variables', async () => {
        const lines: string[] = []
        const handleLine = jest.fn((context, stream, line) => {
            lines.push(line)
        })

        await task.runChildProcess(process.execPath, {
            inheritEnv: false,
            env: { PATH: process.env.PATH, TEST_ENV_A: 'A', TEST_ENV_B: undefined },
            prependArgs: ['-e'],
            lineHandlers: [handleLine],
        }, `
            Object.entries(process.env).forEach(function (value) {
                console.log(value[0] + ': ' + value[1])
            })
        `)

        expect(handleLine).toBeCalled()
        expect(lines).toContain(`PATH: ${process.env.PATH}`)
        expect(lines).toContain(`TEST_ENV_A: A`)
    })

    test('Arguments', async () => {
        const lines: string[] = []
        const handleLine = jest.fn((context, stream, line) => {
            lines.push(line)
        })
        await task.runChildProcess(process.execPath, {
            prependArgs: ['-e'],
            lineHandlers: [handleLine],
        }, `
            process.argv.forEach(function (value) {
                console.log(value)
            })
        `, 'a', 'abc cde', '3')

        expect(handleLine).toBeCalled()
        expect(lines).toContain('a')
        expect(lines).toContain('abc cde')
        expect(lines).toContain('3')
    })

    test('Env inheritance', async () => {
        const lineMatcher = new LineMatcher<NodeJS.ProcessEnv>()
        lineMatcher.add(/^(?<key>[a-zA-Z0-9_]+): (?<value>.*)/, (context, match) => {
            const key = match.groups.key as string
            const value = match.groups.value as string
            context.setData(key, value)
        })
        lineMatcher.setFallback((context, stream, line) => {
            console.log(`FALLBACK LINE on ${stream}:`, line)
        })

        const result = await task.runChildProcess(process.execPath, {
            prependArgs: ['-e'],
            env: {MY_A: 'a', MY_B:'b', MY_C:'c'},
            lineHandlers: [lineMatcher],
        },  `
            Object.entries(process.env).forEach(function (value) {
                console.log(value[0] + ': ' + value[1])
            })
        `)

        expect(result.data).toMatchObject({...process.env, MY_A: 'a', MY_B: 'b', MY_C:'c'})
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

        await task.runChildProcess('echo', {
            lineHandlers: [lineMatcher]
        }, lines.join('\n')).on('progressUpdate', progressUpdate)

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

        const a = await (task.runChildProcess<{a: number, b:number, lastB: string}>('echo', {
            lineHandlers: [lineMatcher]
        }, 'A\n\nA\nC'))
        expect(a.data).toEqual({a: 2})

        const b = await (task.runChildProcess<{a: number, b:number, lastB: string}>('echo', {
            lineHandlers: [lineMatcher]
        }, 'A\nB\nBla\nC'))
        expect(b.data).toEqual({a: 1, b: 2, lastB: 'Bla'})

        const c = await (task.runChildProcess<{a: number, b:number, lastB: string}>('echo', {
            lineHandlers: [lineMatcher]
        }))
        expect(c.data).toEqual({})
    })
})
