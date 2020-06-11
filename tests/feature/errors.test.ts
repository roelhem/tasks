import task from '../../src'
import {TriggerableTaskTemplate} from '../../src/templates'

describe('Error behavior', () => {

    test('Directly throwing an error', async () => {
        const e = new Error('Test Error 1')
        const t = task(() => { throw e })

        expect(t.isReady).toBeTruthy()
        t.run()
        await expect(t).rejects.toThrow(e)

        expect(t.isFailed).toBeTruthy()
        expect(t.failureReason).toBe(e)

        expect(() => t.run()).toThrow()
    })

    test('Throw an error with async definition', async () => {
        const e = new Error('Test Error 2')
        const t = task( async () => { throw e })

        expect(t.isReady).toBeTruthy()
        t.run()
        await expect(t).rejects.toThrow(e)

        expect(t.isFailed).toBeTruthy()
        expect(t.failureReason).toBe(e)

        expect(() => t.run()).toThrow()
    })

    test('Throw an error with the context.reject() method', async () => {
        const e = new Error('Test Error 3')
        const t = task( context => {
            context.reject(e)
        })

        expect(t.isReady).toBeTruthy()
        t.run()
        await expect(t).rejects.toThrow(e)
        expect(t.isFailed).toBeTruthy()
        expect(t.failureReason).toBe(e)
    })

    test('Throwing not an error.', async () => {
        const r = 1
        const t = task(context => {
            context.reject(r)
        })

        expect(t.isReady).toBeTruthy()
        t.run()
        await expect(t).rejects.toBe(r)
        expect(t.isFailed).toBeTruthy()
        expect(t.failureReason).toBe(r)
    })

    test('Throw an error from a subTask with async', async () => {
        const e = new Error('Test Error 4')
        const t = task(async context => {
            await context.runSubTask(() => {
                throw e
            })
        })

        t.run()
        await expect(t).rejects.toThrow(e)

        expect(t.isFailed).toBeTruthy()
        expect(t.failureReason).toBe(e)

        expect(t.subTasks[0].isFailed).toBeTruthy()
        expect(t.subTasks[0].failureReason).toBe(e)
    })

    test('Throwing an error from a subTask set from outside', async () => {
        const e = new Error('Error from SubTask')
        const a = new TriggerableTaskTemplate('RootTask')
        const s1 = new TriggerableTaskTemplate('SubTask1')
        const s2 = new TriggerableTaskTemplate('SubTask2')
        const s3 = new TriggerableTaskTemplate('SubTask3')
        const t = task(a)

        t.run()

        await a
        a.context.runSubTask(s1)
        expect(t.subTasks).toHaveLength(1)
        expect(t.subTasks[0].name).toBe('SubTask1')
        a.context.runSubTask(s2).catch(() => { return })
        expect(t.subTasks).toHaveLength(2)
        expect(t.subTasks[1].name).toBe('SubTask2')
        a.context.runSubTask(s3)
        expect(t.subTasks).toHaveLength(3)
        expect(t.subTasks[2].name).toBe('SubTask3')

        await s1
        s1.context.resolve()

        await s2
        s2.context.reject(e)

        await s3
        const s3Interrupter = jest.fn(_flag => { return true })
        s3.context.setInterrupter(s3Interrupter)

        await expect(t).rejects.toThrow(e)
        expect(t.isFailed).toBeTruthy()
        expect(t.failureReason).toBe(e)

        expect(t.subTasks[0].isSucceeded).toBeTruthy()
        expect(t.subTasks[1].isFailed).toBeTruthy()
        expect(t.subTasks[1].failureReason).toBe(e)
        expect(t.subTasks[2].isInterrupted).toBeTruthy()
        expect(s3Interrupter.mock.calls).toHaveLength(1)
        const expectedFlag = task.INTERRUPT_FROM_PARENT | task.INTERRUPT_FROM_CHILD | task.INTERRUPT_FROM_FAILURE
        expect(s3Interrupter.mock.calls[0][0]).toBe(expectedFlag)

    })

})
