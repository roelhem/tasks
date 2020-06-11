import {TriggerableTaskTemplate} from '../../src/templates'
import task, {TaskInterruptionError} from '../../src'

describe('Interruption behaviour', () => {

    test('Outside call without interrupter set.', async () => {
        const a = new TriggerableTaskTemplate()
        const t = task(a)

        t.run().catch(() => { return })
        expect(t.isRunning).toBeTruthy()

        const pr = t.interrupt()
        a.context.resolve()

        expect(await pr).toBeNull()

        expect(t.isSucceeded).toBeTruthy()
    })

    test('Outside call with interrupter.', async () => {
        const a = new TriggerableTaskTemplate<void, [], string, string>()
        const t = task(a)
        const interrupter = jest.fn(_flag => { return 'interrupted' })

        t.run().catch(() => { return })

        await a
        a.context.setInterrupter(interrupter)

        const pr = t.interrupt(task.INTERRUPT_TEST)
        expect(await pr).toBe('interrupted')

        expect(t.isInterrupted).toBeTruthy()
        expect(t.interruptionResult).toBe('interrupted')
        expect(t.failureReason).toBeInstanceOf(TaskInterruptionError)
        expect(t.failureReason).toHaveProperty('interruptionResult','interrupted')
        expect(interrupter.mock.calls).toHaveLength(1)
        expect(interrupter.mock.calls[0][0]).toBe(task.INTERRUPT_TEST)
    })

    test('Outside call with interrupter with void return.', async () => {
        const a = new TriggerableTaskTemplate()
        const t = task(a)

        const interrupter = jest.fn(_flag => { return })

        t.run().catch(() => { return })

        await a
        a.context.setInterrupter(interrupter)

        const pr = t.interrupt(task.INTERRUPT_TEST)
        expect(await pr).toBeUndefined()

        expect(t.isInterrupted).toBeTruthy()
        expect(t.interruptionResult).toBeUndefined()
        expect(t.failureReason).toBeInstanceOf(TaskInterruptionError)
        expect(interrupter.mock.calls).toHaveLength(1)
        expect(interrupter.mock.calls[0][0]).toBe(task.INTERRUPT_TEST)
    })

    test('Outside call with sub-process.', async () => {
        const a = new TriggerableTaskTemplate('SubTaskA')
        const aInterrupter = jest.fn(_flag => { return 'A_interrupted' })
        const t = task(async context => { await context.runSubTask(a) })
        expect(t.isReady).toBeTruthy()

        t.run().catch(() => { return })
        await a
        a.context.setInterrupter(aInterrupter)
        expect(t.isRunning).toBeTruthy()

        expect(await t.interrupt(task.INTERRUPT_TEST)).toBe('A_interrupted')
        await expect(t).rejects.toThrow(TaskInterruptionError)
        expect(t.isInterrupted).toBeTruthy()
        expect(t.interruptionResult).toBe('A_interrupted')
    })

})
