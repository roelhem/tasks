import task, {TaskFunction} from '../../src'

describe('Emitting custom events', () => {

    test('From main task', async () => {
        const f: TaskFunction = async (context) => {
            context.emit('A', 1)
        }
        const l = jest.fn((_num) => { return })
        const t = task.create(f).on('A', l)
        expect(l).toBeCalledTimes(0)
        await t.run()
        expect(l).toBeCalledTimes(1)
        expect(l).toBeCalledWith(1)
    })

    test('From sub Tasks', async () => {
        const fa: TaskFunction = async (context) => {
            context.emit('A', 2, 'a')
        }
        const fb: TaskFunction = async (context) => {
            await context.runSubTask(fa)
        }
        const l = jest.fn((_num) => { return })
        const t = task.create(fb).on('A', l)
        expect(l).toBeCalledTimes(0)
        await t.run()
        expect(l).toBeCalledTimes(1)
        expect(l).toBeCalledWith(2, 'a')
    })

    test('From sub sub Task', async () => {
        const fa: TaskFunction = async (context) => {
            context.emit('A', 3, 'aa')
        }
        const fb: TaskFunction = async (context) => {
            await context.runSubTask(fa)
        }
        const fc: TaskFunction = async (context) => {
            await context.runSubTask(fb)
        }
        const la = jest.fn((_num) => { return })
        const t = task.create(fb).on('A', la)
        expect(la).toBeCalledTimes(0)
        await t.run()
        expect(la).toBeCalledTimes(1)
        expect(la).toBeCalledWith(3, 'aa')
    })

    test('Copy subTask events', async () => {
        const fa: TaskFunction = async (context) => {
            context.emit('A', 2, 'a')
        }
        const fb: TaskFunction = async (context) => {
            await context.runSubTask({ inheritProgress: true, events: ['A']}, fa)
        }
        const l = jest.fn((_num) => { return })
        const t = task.create(fb).on('A', l)
        expect(l).toBeCalledTimes(0)
        await t.run()
        expect(l).toBeCalledTimes(2)
        expect(l).toBeCalledWith(2, 'a')
    })

})
