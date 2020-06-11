import task, { Task } from '../../src'

describe('task', () => {

    test('Function call without name', () => {
        const t = task(() => { return })
        expect(t).toBeInstanceOf(Task)
    })

    test('Function call with name', () => {
        const t = task('TaskName', () => { return })
        expect(t).toBeInstanceOf(Task)
        expect(t.name).toBe('TaskName')
    })

    test('Create call without name', () => {
        const t = task.create(() => { return })
        expect(t).toBeInstanceOf(Task)
    })

    test('Create call with name', () => {
        const t = task.create('TaskName', () => { return })
        expect(t).toBeInstanceOf(Task)
        expect(t.name).toBe('TaskName')
    })

    test('Run call with name', () => {
        const t = task.run<void, [number, number,number]>('TaskName', (() => { return }), 1, 2, 3)
        expect(t).toBeInstanceOf(Task)
        expect(t.name).toBe('TaskName')
        expect(t.args).not.toBeUndefined()
        expect(t.args).toHaveLength(3)
        expect((t.args as any[])[0]).toBe(1)
        expect((t.args as any[])[1]).toBe(2)
        expect((t.args as any[])[2]).toBe(3)
    })

    test('Run call without name', () => {
        const t = task.run<void, [number, number,number]>((() => { return }), 1, 2, 3)
        expect(t).toBeInstanceOf(Task)
        expect(t.args).not.toBeUndefined()
        expect(t.args).toHaveLength(3)
        expect((t.args as any[])[0]).toBe(1)
        expect((t.args as any[])[1]).toBe(2)
        expect((t.args as any[])[2]).toBe(3)
    })

})
