import {fillMissingProperties, mergeDefaultProps} from '../../../src/utils'

describe('fillMissingProperties', () => {
    test('emptyObject', () => {
        const res = fillMissingProperties(['a','b','c'], {}, 1)
        expect(res).toEqual({
            a: 1,
            b: 1,
            c: 1,
        })
    })

    test('just one property to set', () => {
        const res = fillMissingProperties(['a','b','c'], {a: 2, b: 3}, 1)
        expect(res).toEqual({
            a: 2,
            b: 3,
            c: 1,
        })
    })

    test('With extra prop', () => {
        const res = fillMissingProperties(['a','b','c'], {a: 2, b: 3, d: 4}, 1)
        expect(res).toEqual({
            a: 2,
            b: 3,
            c: 1,
            d: 4,
        })
    })

    test('Default value in object', () => {
        const res = fillMissingProperties(['a','b','c'], {a: 2, b: 3, d: 4, default: 1})
        expect(res).toEqual({
            a: 2,
            b: 3,
            c: 1,
            d: 4,
            default: 1,
        })
    })
})

describe('mergeDefaultProps', () => {

    test('empty with defaults', () => {
        const res = mergeDefaultProps({}, {a: 1, b: 2})
        expect(res).toEqual({a: 1, b: 2})
    })

    test('Some set properties', () => {
        const res = mergeDefaultProps({a: 3}, {a: 1, b: 2})
        expect(res).toEqual({a: 3, b: 2})
    })

    test('Overwrite number 10', () => {
        const res = mergeDefaultProps({a: 10}, {a: 1, b: 2}, [10])
        expect(res).toEqual({a: 1, b: 2})
    })

})
