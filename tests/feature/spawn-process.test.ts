import task, {SpawnProcessTaskTemplate} from '../../src'
import {SendHandle, Serializable} from 'child_process'
import {WritableManager} from '../../src/templates/WritableManager'
import {Hooks} from '../../src/templates/ChildProcessTaskTemplate'

function createMockHooks(name: string = ''): Hooks {
    const prefix = name ? `${name}:` : ''
    return {
        onClose: jest.fn((code: number, signal: NodeJS.Signals) => {
            console.log(prefix, 'CLOSE', code, signal)
        }),
        onDisconnect: jest.fn(() => {
            console.log(prefix, 'DISCONNECT')
        }),
        onError: jest.fn((error: Error) => {
            console.log(prefix, 'ERROR', error)
        }),
        onExit: jest.fn((code: number|null, signal: NodeJS.Signals|null) => {
            console.log(prefix, 'EXIT', code, signal)
        }),
        onMessage: jest.fn((message: Serializable, sendHandle: SendHandle) => {
            console.log(prefix, 'MESSAGE', message, sendHandle)
        }),
        onData: jest.fn((stream: string, chunk: string|Buffer) => {
            console.log(prefix, `GOT DATA FROM '${stream}': `, chunk)
        }),
        onLine: jest.fn((stream: string, line: string) => {
            console.log(prefix, `GOT A LINE FROM '${stream}': `, line)
        }),
        onSendAvailable: jest.fn((stream: string, send: WritableManager) => {
            console.log(prefix, `SEND AVAILABLE FROM '${stream}': `, send)
        })
    }
}

describe('Usage with Spawn - ChildProcesses', () => {

    test('Echo a string', async () => {
        const a = new SpawnProcessTaskTemplate('echo', {
            name: '[Echo a string](a)',
            prefixArgs: ['prefixArg']
        })

        const hooks = createMockHooks('Echo Task')


        await task.run(a, {
            args: ['\nargFromTask', '\nlastArg']
        }, hooks)

        expect(hooks.onLine).toBeCalledWith('stdout', 'prefixArg ')
        expect(hooks.onLine).toBeCalledWith('stdout', 'argFromTask ')
        expect(hooks.onLine).toBeCalledWith('stdout', 'lastArg')
    })

    test('Get node version', async () => {
        const a = new SpawnProcessTaskTemplate('node', {
            prefixArgs: ['--version']
        })
        const hooks = createMockHooks('Echo Task')
        await task.run(a, undefined, hooks)

        expect(hooks.onLine).toBeCalled()
    })

})
