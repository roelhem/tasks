import task from '../../src'
import {TriggerableTaskTemplate} from '../../src/templates'

describe('Usages with progress', () => {

    test('simple progress getting from event.', async () => {
        const a = new TriggerableTaskTemplate()
        const t = task(a)

        const pl = jest.fn((_p: number, _pt?: number , _m?: string) => { return })
        t.on('progressUpdate', pl)
        expect(pl.mock.calls).toHaveLength(0)

        t.run()

        expect(t.isRunning).toBeTruthy()
        expect(t.currentProgress).toBe(0)
        expect(t.totalProgress).toBeUndefined()
        expect(t.progressFraction).toBeUndefined()
        expect(t.lastProgressMessage).toBeUndefined()
        expect(pl.mock.calls).toHaveLength(1)
        expect(pl.mock.calls[0][0]).toBe(0)
        expect(pl.mock.calls[0][1]).toBeUndefined()

        a.context.setProgressTotal(4)
        expect(t.currentProgress).toBe(0)
        expect(t.totalProgress).toBe(4)
        expect(t.progressFraction).toBe(0)
        expect(t.lastProgressMessage).toBeUndefined()
        expect(pl.mock.calls).toHaveLength(2)
        expect(pl.mock.calls[1][0]).toBe(0)
        expect(pl.mock.calls[1][1]).toBe(4)

        a.context.setProgress(1)
        expect(t.currentProgress).toBe(1)
        expect(t.totalProgress).toBe(4)
        expect(t.progressFraction).toBe(0.25)
        expect(t.lastProgressMessage).toBeUndefined()
        expect(pl.mock.calls).toHaveLength(3)
        expect(pl.mock.calls[2][0]).toBe(1)
        expect(pl.mock.calls[2][1]).toBe(4)

        a.context.setProgress(2, 5)
        expect(t.currentProgress).toBe(2)
        expect(t.totalProgress).toBe(5)
        expect(t.progressFraction).toBe(0.4)
        expect(t.lastProgressMessage).toBeUndefined()
        expect(pl.mock.calls).toHaveLength(4)
        expect(pl.mock.calls[3][0]).toBe(2)
        expect(pl.mock.calls[3][1]).toBe(5)

        a.context.setProgress(2)
        expect(pl.mock.calls).toHaveLength(4)

        a.context.setProgressMessage('test')
        expect(t.lastProgressMessage).toBe('test')
        expect(pl.mock.calls).toHaveLength(5)
        expect(pl.mock.calls[4][0]).toBe(2)
        expect(pl.mock.calls[4][1]).toBe(5)
        expect(pl.mock.calls[4][2]).toBe('test')

        a.context.resolve()
        expect(t.state).toBeTruthy()
        expect(t.currentProgress).toBe(5)
        expect(t.totalProgress).toBe(5)
        expect(t.progressFraction).toBe(1)
        expect(t.lastProgressMessage).toBe('test')
        expect(pl.mock.calls).toHaveLength(6)
        expect(pl.mock.calls[5][0]).toBe(5)
        expect(pl.mock.calls[5][1]).toBe(5)
        expect(pl.mock.calls[5][2]).toBe('test')
    })

    test('minimal progress behaviour', () => {
        const a = new TriggerableTaskTemplate()
        const t = task(a)

        t.run()
        expect(t.currentProgress).toBe(0)
        expect(t.totalProgress).toBeUndefined()

        a.context.resolve()
        expect(t.currentProgress).toBe(1)
        expect(t.totalProgress).toBe(1)
    })

    test('progress without total', () => {
        const a = new TriggerableTaskTemplate()
        const t = task(a)

        t.run()
        expect(t.currentProgress).toBe(0)
        expect(t.totalProgress).toBeUndefined()

        a.context.setProgress(2)
        expect(t.currentProgress).toBe(2)
        expect(t.totalProgress).toBeUndefined()

        a.context.resolve()
        expect(t.currentProgress).toBe(2)
        expect(t.totalProgress).toBe(2)
    })

    test('sub-task progress inheritance', async () => {
        const a = new TriggerableTaskTemplate('SubTask A')
        const b = new TriggerableTaskTemplate('SubTask B')
        const t = task('MainTask', async context => {
            context.setProgressTotal(3)
            await context.runSubTask([0, 2], a)
            await context.runSubTask([2, 3], b)
        })

        t.run()
        expect(t.isRunning).toBeTruthy()
        expect(t.currentProgress).toBe(0)
        expect(t.totalProgress).toBe(3)

        await a

        a.context.resolve()
        expect(t.currentProgress).toBe(2)
        expect(t.totalProgress).toBe(3)

        await b

        b.context.setProgressTotal(10)
        expect(t.currentProgress).toBe(2)
        expect(t.totalProgress).toBe(3)

        b.context.setProgress(1)
        expect(t.currentProgress).toBe(2.1)
        expect(t.totalProgress).toBe(3)

        b.context.setProgressTotal(5)
        expect(t.currentProgress).toBe(2.2)
        expect(t.totalProgress).toBe(3)
        expect(t.lastProgressMessage).toBeUndefined()

        b.context.setProgressMessage('B')
        expect(t.currentProgress).toBe(2.2)
        expect(t.totalProgress).toBe(3)
        expect(t.lastProgressMessage).toBe('B')

        b.context.resolve()
        expect(t.currentProgress).toBe(3)
        expect(t.totalProgress).toBe(3)
        expect(t.lastProgressMessage).toBe('B')
    })

})
