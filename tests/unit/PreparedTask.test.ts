import {Task} from '../../src'
import PreparedTask from '../../src/PreparedTask'

describe('PreparedTask', () => {

    describe('constructor', () => {
        test('Can initialize', () => {
            const t = new Task<void, [string]>(() => { return })
            const p = new PreparedTask(t, 'test')
            expect(p).toBeInstanceOf(PreparedTask)
        })
    })

})
