import SpawnProcessTaskTemplate from '../../../src/templates/SpawnProcessTaskTemplate'
import ChildProcessTaskTemplate from '../../../src/templates/ChildProcessTaskTemplate'

describe('SpawnProcessTaskTemplate', () => {

    test('constructor', () => {
        const t = new SpawnProcessTaskTemplate('python')
        expect(t).toBeInstanceOf(SpawnProcessTaskTemplate)
        expect(t).toBeInstanceOf(ChildProcessTaskTemplate)
    })

    test('.defaultName', () => {
        const a = new SpawnProcessTaskTemplate('python')
        expect(a.defaultName).toBe('python')

        const b = new SpawnProcessTaskTemplate('python', {
            prefixArgs: ['--version']
        })
        expect(b.defaultName).toBe('python --version')
    })

    test('.taskName', () => {
        const a = new SpawnProcessTaskTemplate('command')
        expect(a.taskName).toBe('command')

        const b = new SpawnProcessTaskTemplate('command', {
            prefixArgs: ['arg1', 'arg2']
        })
        expect(b.defaultName).toBe('command arg1 arg2')
    })

})
