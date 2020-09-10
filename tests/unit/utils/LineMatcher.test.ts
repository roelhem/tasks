import {LineMatcher} from '../../../src/utils'
import {ChildProcess} from '../../../src'
import ChildProcessContext from '../../../src/utils/ChildProcessContext'

describe('LineMatcher', () => {

    test('.add', () => {
        const lineMatch = new LineMatcher()
        lineMatch.add('string')
        lineMatch.add(/str/)
        lineMatch.add(() => { return null })
        expect(lineMatch.length).toBe(3)
    })

    describe('.match', () => {
        test('Simple Calls', () => {
            const lineMatch = new LineMatcher()
            lineMatch.add('abc')
            lineMatch.add(/(a)(b?)(?<val>c?)/)
            lineMatch.add('d', undefined, 'stderr')
            lineMatch.add(line => {
                if (line === 'a') { return {line, match: 'a', parts:[], groups: {func: 'A'}} }
                else { return null }
            })

            const abcdStderr = lineMatch.match('stderr', 'abcd')
            expect(abcdStderr).toHaveLength(3)
            expect(abcdStderr).toContainEqual({
                line: 'abcd',
                match: 'abc',
                parts: [],
                groups: {}
            })
            expect(abcdStderr).toContainEqual({
                line: 'abcd',
                match: 'abc',
                parts: ['a', 'b', 'c'],
                groups: {val: 'c'}
            })
            expect(abcdStderr).toContainEqual({
                line: 'abcd',
                match: 'd',
                parts: [],
                groups: {}
            })

            const a = lineMatch.match('stdout', 'a')
            expect(a).toHaveLength(2)
            expect(a).toContainEqual({
                line: 'a',
                match: 'a',
                parts: ['a', '', ''],
                groups: {val: ''}
            })
            expect(a).toContainEqual({
                line: 'a',
                match: 'a',
                parts: [],
                groups: {func: 'A'}
            })

            const e = lineMatch.match('stdout', 'e')
            expect(e).toHaveLength(0)

            const d = lineMatch.match('stdout', 'd')
            expect(d).toHaveLength(0)

            const dStderr = lineMatch.match('stderr', 'd')
            expect(dStderr).toHaveLength(1)
        })
    })

    test('.lineHandler', () => {
        const lineMatch = new LineMatcher()
        const lineIsA = jest.fn((_c, _m, _s) => { return })
        lineMatch.add(/^A$/, lineIsA)
        const lineIsB = jest.fn((_c, _m, _s) => { return })
        lineMatch.add(/^B$/, lineIsB)

        const that = new ChildProcess('echo')

        lineMatch.call(that, {} as ChildProcessContext, 'stdout', 'C')
        expect(lineIsA).toBeCalledTimes(0)
        expect(lineIsB).toBeCalledTimes(0)

        lineMatch.call(that, {} as ChildProcessContext, 'stdout', 'A')
        expect(lineIsA).toBeCalledTimes(1)
        expect(lineIsB).toBeCalledTimes(0)

        lineMatch.call(that, {} as ChildProcessContext, 'stdout', 'B')
        expect(lineIsA).toBeCalledTimes(1)
        expect(lineIsB).toBeCalledTimes(1)

        lineMatch.call(that, {} as ChildProcessContext, 'stdout', 'A')
        expect(lineIsA).toBeCalledTimes(2)
        expect(lineIsB).toBeCalledTimes(1)
    })

})
