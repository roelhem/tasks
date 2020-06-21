import {argAsArray} from '../../../src/utils'

describe('argAsArray', function () {

    test('Array value', () => {
        const arg = ['a','b','c']
        expect(argAsArray(arg)).toBe(arg)
    })

    test('Empty Array', () => {
        const arg: any[] = []
        expect(argAsArray(arg)).toBe(arg)
    })

    test('String value', () => {
        expect(argAsArray('hoi')).toEqual(['hoi'])
    })

    test('Object value', () => {
        const obj = {}
        expect(argAsArray(obj)).toEqual([obj])
    })

    test('Empty value without default', () => {
        expect(argAsArray(undefined)).toEqual([])
        expect(argAsArray(null)).toEqual([])
    })

    test('Empty value with array default', () => {
        const defaultValue = [0]
        expect(argAsArray(undefined, defaultValue)).toBe(defaultValue)
        expect(argAsArray(null, defaultValue)).toBe(defaultValue)
    })

    test('Empty value with null default', () => {
        expect(argAsArray(undefined, null)).toBeNull()
        expect(argAsArray(null, null)).toBeNull()
    })

})
