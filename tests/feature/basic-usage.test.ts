import task, {Task, TaskFunction} from '../../src'

describe('Basic Usage', () => {

    test('Running a simple task', async () => {
        const f: TaskFunction<number> & jest.Mock = jest.fn(() => { return 1 })

        const t = task(f)

        expect(t).toBeInstanceOf(Task)
        expect(t.isReady).toBeTruthy()
        expect(f.mock.calls).toHaveLength(0)

        const result = await t.run()

        expect(result).toBe(1)
        expect(t.isSucceeded).toBeTruthy()
        expect(f.mock.calls).toHaveLength(1)

        expect(() => { t.run() }).toThrow()
    })

})
