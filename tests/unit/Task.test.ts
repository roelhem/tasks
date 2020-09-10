import {Task, TaskInterruptionError} from '../../src'
import {DEFAULT_TASK_NAME} from '../../src/constants'
import TaskContext from '../../src/utils/TaskContext'
import {TaskState} from '../../src/types'
import {TriggerableTaskTemplate} from '../../src/templates'

describe('Task', () => {

    describe('constructor', () => {

        test('Can be constructed', () => {
            const a = new Task(() => { return })
            expect(a).toBeInstanceOf(Task)
        })

    })

    describe('.[Symbol.toStringTag]', () => {

        test('For function without a name', () => {
            const a = new Task(() => { return })
            expect(a[Symbol.toStringTag]).toBe(`Task[${DEFAULT_TASK_NAME}]`)
            expect(a.toString()).toBe(`[object Task[${DEFAULT_TASK_NAME}]]`)
        })

        test('For function with a name', () => {
            const b = new Task('B', () => { return })
            expect(b[Symbol.toStringTag]).toBe(`Task[B]`)
            expect(b.toString()).toBe(`[object Task[B]]`)
        })

        test('For unnamed provider with a name', () => {
            const c = new Task('C', { task: () => { return } })
            expect(c[Symbol.toStringTag]).toBe(`Task[C]`)
            expect(c.toString()).toBe(`[object Task[C]]`)
        })

        test('For named provider without a name', () => {
            const d = new Task({ task: () => { return }, taskName: 'D' })
            expect(d[Symbol.toStringTag]).toBe(`Task[D]`)
            expect(d.toString()).toBe(`[object Task[D]]`)
        })

        test('For named provider with a name', () => {
            const e = new Task('e', { task: () => { return }, taskName: 'E' })
            expect(e[Symbol.toStringTag]).toBe(`Task[E:e]`)
            expect(e.toString()).toBe(`[object Task[E:e]]`)
        })
    })

    test('.name', () => {
        const a = new Task(() => { return })
        expect(a.name).toBe(DEFAULT_TASK_NAME)

        const b = new Task('B', () => { return })
        expect(b.name).toBe(`B`)

        const c = new Task('C', { task: () => { return } })
        expect(c.name).toBe(`C`)

        const d = new Task({ task: () => { return }, taskName: 'D' })
        expect(d.name).toBe(`D`)

        const e = new Task('e', { task: () => { return }, taskName: 'E' })
        expect(e.name).toBe(`E:e`)
    })

    test('.args', () => {
        const a = new Task<void, [string, number]>((_context, _a, _b) => { return })

        expect(a.args).toBeUndefined()

        a.run('a', 1)
        expect(a.args).toHaveLength(2)
        expect((a.args as [string, number])[0]).toBe('a')
        expect((a.args as [string, number])[1]).toBe(1)

        const b = new Task(() => { return })
        expect(b.args).toBeUndefined()

        b.run()
        expect(b.args).toHaveLength(0)
    })

    test('.result', async () => {
        const a = new Task(async () => { return })

        expect(a.result).toBeUndefined()
        await a.run()
        expect(a.result).toBeUndefined()

        const b = new Task<string>(async () => { return 'B' })

        expect(b.result).toBeUndefined()
        await b.run()
        expect(b.result).toBe('B')

        const c = new Task<string>( () => { return 'C' })

        expect(c.result).toBeUndefined()
        c.run()
        expect(c.result).toBe('C')

        const d = new Task<string>( context => { context.resolve('D') })

        expect(d.result).toBeUndefined()
        d.run()
        expect(d.result).toBe('D')

        const eTemplate = new TriggerableTaskTemplate<string>('TriggerableTask e')
        const e = new Task<string>(eTemplate)

        expect(e.result).toBeUndefined()
        e.run()
        await eTemplate
        expect(e.result).toBeUndefined()
        eTemplate.context.resolve('E')
        expect(e.result).toBe('E')
    })

    describe('.interruptionResult', () => {
        test('Simple task', async () => {
            const a = new Task(async () => { return })
            expect(a.interruptionResult).toBeUndefined()
            await a.run()
            expect(a.interruptionResult).toBeUndefined()
        })

        test('From interrupt call', async () => {
            const b = new Task<void, [], string, number>(context => { context.interrupt(1) })
            expect(b.interruptionResult).toBeUndefined()
            await expect(b.run()).rejects.toThrow(TaskInterruptionError)
            expect(b.interruptionResult).toBe(1)
        })

        test('By throwing an TaskInterruptionError', async () => {
            const c = new Task(async () => { throw new TaskInterruptionError('C') })
            await expect(c.run()).rejects.toThrow(TaskInterruptionError)
            expect(c.interruptionResult).toBe('C')
        })

        test('By calling .interrupt()', async () => {
            const d = new Task(async context => {
                context.addInterrupter(() => { return 'D' })
            })

            d.run().catch()
            expect(d.interruptionResult).toBeUndefined()
            await d.interrupt()
            expect(d.interruptionResult).toBe('D')
        })
    })

    test('.interruptionError', async () => {
        const a = new Task(async () => { return })
        expect(a.interruptionError).toBeUndefined()
        await a.run()
        expect(a.interruptionError).toBeUndefined()

        const b = new Task<void, [], string, number>(context => { context.interrupt(1) })
        expect(b.interruptionError).toBeUndefined()
        await expect(b.run()).rejects.toThrow(TaskInterruptionError)
        expect(b.interruptionError).toBeInstanceOf(TaskInterruptionError)
        expect(b.interruptionError).toHaveProperty('interruptionResult', 1)

        const c = new Task(async () => { throw new TaskInterruptionError('C') })
        await expect(c.run()).rejects.toThrow(TaskInterruptionError)
        expect(c.interruptionError).toBeInstanceOf(TaskInterruptionError)
        expect(c.interruptionError).toHaveProperty('interruptionResult', 'C')

        const d = new Task(async context => {
            context.addInterrupter(() => { return 'D' })
        })

        d.run().catch()
        expect(d.interruptionError).toBeUndefined()
        await d.interrupt()
        expect(d.interruptionError).toBeInstanceOf(TaskInterruptionError)
        expect(d.interruptionError).toHaveProperty('interruptionResult', 'D')

        const e = new Task(async context => {
            context.addInterrupter(() => { return })
        })

        e.run().catch()
        expect(e.interruptionError).toBeUndefined()
        await e.interrupt()
        expect(e.interruptionError).toBeInstanceOf(TaskInterruptionError)
        expect(e.interruptionError).toHaveProperty('interruptionResult', undefined)
    })

    test('.failureReason', async () => {
        const aError =  new Error('A')
        const a = new Task(() => { throw aError })
        expect(a.failureReason).toBeUndefined()
        await expect(a.run()).rejects.toThrow(aError)
        expect(a.failureReason).toBe(aError)

        const b = new Task(context => { context.interrupt('B') })
        await expect(b.run()).rejects.toThrow(TaskInterruptionError)
        expect(b.interruptionError).toBeInstanceOf(TaskInterruptionError)
        expect(b.interruptionError).toHaveProperty('interruptionResult', 'B')

        const c = new Task(async () => { return  })
        expect(c.interruptionError).toBeUndefined()
        await c.run()
        expect(c.interruptionError).toBeUndefined()

        const d = new Task(context => { context.reject('D') })
        await expect(d.run()).rejects
        expect(d.failureReason).toBe('D')
    })

    test('.state', async () => {
        const a = new Task(async () => { return })
        expect(a.state).toBe(TaskState.READY)
        await a.run()
        expect(a.state).toBe(TaskState.SUCCEEDED)

        const bTemplate = new TriggerableTaskTemplate()
        const b = new Task(bTemplate)
        expect(b.state).toBe(TaskState.READY)
        b.run()
        expect(b.state).toBe(TaskState.RUNNING)
        bTemplate.context.resolve()
        expect(b.state).toBe(TaskState.SUCCEEDED)

        const cError = new Error('C')
        const c = new Task(() => { throw cError })
        await expect(c.run()).rejects.toThrow(cError)
        expect(c.state).toBe(TaskState.FAILED)

        const d = new Task(async () => { throw new TaskInterruptionError('D') })
        await expect(d.run()).rejects.toThrow(TaskInterruptionError)
        expect(d.state).toBe(TaskState.INTERRUPTED)

        const e = new Task(context => { context.reject('E') })
        await expect(e.run()).rejects
        expect(e.state).toBe(TaskState.FAILED)
    })

    test('.isReady', async () => {
        const aTemplate = new TriggerableTaskTemplate()
        const a = new Task(aTemplate)
        expect(a.isReady).toBeTruthy()
        a.run()
        expect(a.isReady).toBeFalsy()
        aTemplate.context.resolve()
        expect(a.isReady).toBeFalsy()
    })

    test('.isRunning', async () => {
        const aTemplate = new TriggerableTaskTemplate()
        const a = new Task(aTemplate)
        expect(a.isRunning).toBeFalsy()
        a.run()
        expect(a.isRunning).toBeTruthy()
        aTemplate.context.resolve()
        expect(a.isRunning).toBeFalsy()
    })

    test('.isSucceeded', async () => {
        const aTemplate = new TriggerableTaskTemplate()
        const a = new Task(aTemplate)
        expect(a.isSucceeded).toBeFalsy()
        a.run()
        expect(a.isSucceeded).toBeFalsy()
        aTemplate.context.resolve()
        expect(a.isSucceeded).toBeTruthy()
    })

    test('.isFailed', async () => {
        const aTemplate = new TriggerableTaskTemplate()
        const a = new Task(aTemplate)
        expect(a.isFailed).toBeFalsy()
        a.run().catch(() => { return })
        expect(a.isFailed).toBeFalsy()
        aTemplate.context.reject(new Error('A'))
        expect(a.isFailed).toBeTruthy()
    })

    test('.isInterrupted', async () => {
        const aTemplate = new TriggerableTaskTemplate()
        const a = new Task(aTemplate)
        expect(a.isInterrupted).toBeFalsy()
        a.run().catch(() => { return })
        expect(a.isInterrupted).toBeFalsy()
        aTemplate.context.interrupt('A')
        expect(a.isInterrupted).toBeTruthy()
    })

    test('.isFinished', async () => {
        const aTemplate = new TriggerableTaskTemplate()
        const a = new Task(aTemplate)
        expect(a.isFinished).toBeFalsy()
        a.run()
        expect(a.isFinished).toBeFalsy()
        aTemplate.context.resolve()
        expect(a.isFinished).toBeTruthy()

        const bError = new Error('B')
        const b = new Task(async () => { throw bError })
        expect(b.isFinished).toBeFalsy()
        await expect(b.run()).rejects.toThrow(bError)
        expect(b.isFinished).toBeTruthy()

        const c = new Task(context => { context.interrupt('C') })
        expect(c.isFinished).toBeFalsy()
        await expect(c.run()).rejects.toThrow(TaskInterruptionError)
        expect(c.isFinished).toBeTruthy()
    })

    test('.currentProgress', async () => {
        const aTemplate = new TriggerableTaskTemplate()
        const a = new Task(aTemplate)
        expect(a.currentProgress).toBe(0)
        a.run()
        expect(a.currentProgress).toBe(0)
        aTemplate.context.setProgress(1)
        expect(a.currentProgress).toBe(1)
        aTemplate.context.setProgressTotal(2)
        expect(a.currentProgress).toBe(1)
        aTemplate.context.resolve()
        expect(a.currentProgress).toBe(2)

        const bTemplate = new TriggerableTaskTemplate()
        const bError = new Error('B')
        const b = new Task(bTemplate)
        expect(b.currentProgress).toBe(0)
        b.run().catch(() => { return })
        expect(b.currentProgress).toBe(0)
        bTemplate.context.setProgress(1)
        expect(b.currentProgress).toBe(1)
        bTemplate.context.setProgressTotal(2)
        expect(b.currentProgress).toBe(1)
        bTemplate.context.reject(bError)
        await expect(b).rejects.toThrow(bError)
        expect(b.currentProgress).toBe(1)
    })

    test('.totalProgress', async () => {
        const aTemplate = new TriggerableTaskTemplate()
        const a = new Task(aTemplate)
        expect(a.totalProgress).toBeUndefined()
        a.run()
        expect(a.totalProgress).toBeUndefined()
        aTemplate.context.setProgress(0.5)
        expect(a.totalProgress).toBeUndefined()
        aTemplate.context.setProgressTotal(1)
        expect(a.totalProgress).toBe(1)
        aTemplate.context.setProgressTotal(10)
        expect(a.totalProgress).toBe(10)
        aTemplate.context.setProgressTotal(5)
        expect(a.totalProgress).toBe(5)
        aTemplate.context.resolve()
        expect(a.totalProgress).toBe(5)

        const bTemplate = new TriggerableTaskTemplate()
        const b = new Task(bTemplate)
        expect(b.totalProgress).toBeUndefined()
        b.run()
        expect(b.totalProgress).toBeUndefined()
        bTemplate.context.setProgress(2)
        expect(b.totalProgress).toBeUndefined()
        bTemplate.context.resolve()
        expect(b.totalProgress).toBe(2)

        const c = new Task(async () => { return })
        expect(c.totalProgress).toBeUndefined()
        await c.run()
        expect(c.totalProgress).toBe(1)
    })

    test('.progressFraction', async () => {
        const aTemplate = new TriggerableTaskTemplate()
        const a = new Task(aTemplate)
        expect(a.progressFraction).toBeUndefined()
        a.run()
        expect(a.progressFraction).toBeUndefined()
        aTemplate.context.setProgress(0.5)
        expect(a.progressFraction).toBeUndefined()
        aTemplate.context.setProgressTotal(1)
        expect(a.progressFraction).toBe(0.5)
        aTemplate.context.setProgressTotal(10)
        expect(a.progressFraction).toBe(0.05)
        aTemplate.context.setProgress(1)
        expect(a.progressFraction).toBe(0.1)
        aTemplate.context.setProgressTotal(5)
        expect(a.progressFraction).toBe(0.2)
        aTemplate.context.resolve()
        expect(a.progressFraction).toBe(1)

        const bTemplate = new TriggerableTaskTemplate()
        const b = new Task(bTemplate)
        expect(b.progressFraction).toBeUndefined()
        b.run()
        expect(b.progressFraction).toBeUndefined()
        bTemplate.context.setProgress(2)
        expect(b.progressFraction).toBeUndefined()
        bTemplate.context.resolve()
        expect(b.progressFraction).toBe(1)

        const c = new Task(async () => { return })
        expect(c.progressFraction).toBeUndefined()
        await c.run()
        expect(c.progressFraction).toBe(1)
    })

    test('.lastProgressMessage', async () => {
        const a = new Task(async () => { return })
        expect(a.lastProgressMessage).toBeUndefined()
        await a.run()
        expect(a.lastProgressMessage).toBeUndefined()

        const bTemplate = new TriggerableTaskTemplate()
        const b = new Task(bTemplate)
        expect(b.lastProgressMessage).toBeUndefined()
        b.run()
        expect(b.lastProgressMessage).toBeUndefined()
        bTemplate.context.setProgress(1,10)
        expect(b.lastProgressMessage).toBeUndefined()
        bTemplate.context.setProgressMessage('A')
        expect(b.lastProgressMessage).toBe('A')
        bTemplate.context.setProgress(2)
        expect(b.lastProgressMessage).toBe('A')
        bTemplate.context.setProgress(3, undefined, 'B')
        expect(b.lastProgressMessage).toBe('B')
        bTemplate.context.resolve()
        await b
        expect(b.lastProgressMessage).toBe('B')
    })

    test('Initialisation without name', () => {
        const t = new Task(() => { return })
        expect(t).toBeInstanceOf( Task )
        expect(t.name).toBe(DEFAULT_TASK_NAME)
        expect(t.state).toBe(TaskState.READY)
    })

    test('Initialisation with name', () => {
        const t = new Task('TaskName', () => { return })
        expect(t).toBeInstanceOf( Task )
        expect(t.name).toBe('TaskName')
        expect(t.state).toBe(TaskState.READY)
    })

    test('Result (passed by return)', async () => {
        const l = jest.fn(result => { return result })
        const t = new Task(() => { return 4 })
        t.on('succeeded', l)

        expect(t.state).toBe(TaskState.READY)
        expect(l.mock.calls).toHaveLength(0)

        const result = await t.run()
        expect(t.result).toBe(4)
        expect(result).toBe(4)

        expect(t.state).toBe(TaskState.SUCCEEDED)
        expect(l.mock.calls).toHaveLength(1)
        expect(l.mock.calls[0][0]).toBe(4)
    })

    test('Result (passed by context.resolve)', async () => {
        const l = jest.fn(result => { return result })
        const t = new Task((context: TaskContext<number>) => {
            context.resolve(4)
        })
        t.on('succeeded', l)

        expect(t.state).toBe(TaskState.READY)
        expect(l.mock.calls).toHaveLength(0)

        const result = await t.run()
        expect(t.result).toBe(4)
        expect(result).toBe(4)

        expect(t.state).toBe(TaskState.SUCCEEDED)
        expect(l.mock.calls).toHaveLength(1)
        expect(l.mock.calls[0][0]).toBe(4)
    })

})
