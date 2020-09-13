import task from '../../src'

describe('Task throttle', () => {

    test('ProgressUpdates are throttled', async () => {
        const updates: number[] = []
        await task.run(async (context) => {
            const d = new Date()
            let i = 0
            while ((new Date()).valueOf() - 2000 < d.valueOf()) {
                await new Promise((resolve) => setTimeout(resolve, 5))
                context.setProgress(i)
                i++
            }
        }).on('progressUpdate', (current) => {
            console.log('PROGRESS UPDATE!', current)
            updates.push(current)
        })
        expect(updates.length).toBeGreaterThan(10)
        expect(updates.length).toBeLessThan(21)
    }, 4000)

})
