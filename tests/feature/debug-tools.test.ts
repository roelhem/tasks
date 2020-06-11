import {Task} from '../../src'

describe('Debug tools behaviour',  () => {

    test('TaskTree of single task', async () => {
        const t = new Task('RootTask', async () => { return })
        expect(t.getSubTaskTree().split('\n')).toHaveLength(2)
        await t.run()
        expect(t.getSubTaskTree().split('\n')).toHaveLength(2)
        console.log(t.getSubTaskTree())
    })

    test('TaskTree with two subtasks', async () => {
        const t = new Task('RootTask', async context => {
            await context.runSubTask('SubTask A', async () => { return })
            await context.runSubTask('SubTask B', async () => { return })
        })
        await t.run()
        console.log(t.getSubTaskTree())
        expect(t.getSubTaskTree().split('\n')).toHaveLength(4)
    })

    test('Complicated task tree', async () => {
        const t = new Task('RootTask', async context => {
            await context.runSubTask<void>('SubTask A', async () => { return })
            await context.runSubTask<void>('SubTask B', async context => {
                await context.runSubTask('SubTask B1', async () => { return })
                await context.runSubTask('SubTask B2', async () => { return })
                await context.runSubTask<void>('SubTask B3', async context => {
                    await context.runSubTask('SubTask B3-1', async () => { return })
                    await context.runSubTask('SubTask B3-2', async () => { return })
                })
                await context.runSubTask('SubTask B4', async () => { return })
            })
            await context.runSubTask<void>('SubTask C', async context => {
                await context.runSubTask('SubTask C1', async () => { return })
                await context.runSubTask('SubTask C2', async () => { return })
            })
            await context.runSubTask('SubTask D', async () => { return })
        })

        expect(t.getSubTaskTree().split('\n')).toHaveLength(2)
        await t.run()
        console.log(t.getSubTaskTree())
        expect(t.getSubTaskTree().split('\n')).toHaveLength(14)
    })

})
