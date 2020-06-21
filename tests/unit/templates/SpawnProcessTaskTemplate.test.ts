import SpawnProcessTaskTemplate from '../../../src/templates/SpawnProcessTaskTemplate'
import ChildProcessTaskTemplate from '../../../src/templates/ChildProcessTaskTemplate'

describe('SpawnProcessTaskTemplate', () => {

    test('constructor', () => {
        const a = new (SpawnProcessTaskTemplate.create('python', {}, {
            createResult: (context, base) => {
                return base
            },
            getInterruptionResult: async () => {
                return undefined
            }
        }))()
        expect(a).toBeInstanceOf(SpawnProcessTaskTemplate)
        expect(a).toBeInstanceOf(ChildProcessTaskTemplate)
    })

    test('.defaultName', () => {
        const c = SpawnProcessTaskTemplate.create('python')
        const a = new c()
        expect(a.defaultName).toBe('python')

        const b = new c({
            prefixArgs: ['--version']
        })
        expect(b.defaultName).toBe('python --version')
    })

    test('.taskName', () => {
        const c = SpawnProcessTaskTemplate.create('command')
        const a = new c()
        expect(a.taskName).toBe('command')

        const b = new c({
            prefixArgs: ['arg1', 'arg2']
        })
        expect(b.defaultName).toBe('command arg1 arg2')
    })

})
