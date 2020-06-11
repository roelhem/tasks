import {
    NamedTaskProvider,
    ProgressInheritanceOffset, ProgressInheritanceRange,
    ProgressInheritanceScale,
    TaskFunction,
    TaskProvider
} from '../../src/types'
import {
    isNamedTaskProvider, isProgressInheritance, isProgressInheritanceOffset, isProgressInheritanceRange,
    isProgressInheritanceScale,
    isTaskDefinition,
    isTaskFunction,
    isTaskProvider
} from '../../src/utils'

const taskLikeObject = { task: `HELLO HELLO!`, taskName: 'TaskName' }
const taskFunction: TaskFunction = () => { return }
const taskProvider: TaskProvider = { task: taskFunction }
const namedTaskProvider: NamedTaskProvider = { task: taskFunction, taskName: 'TaskName' }

const pScale: ProgressInheritanceScale = 1
const pOffset: ProgressInheritanceOffset = [1]
const pRange: ProgressInheritanceRange = [1, 2]
const threeNumberTuple = [1,2,3]

describe('isTaskFunction', () => {
    test('undefined',        () => expect(isTaskFunction(undefined)).toBeFalsy())
    test('null',             () => expect(isTaskFunction(null)).toBeFalsy())
    test('emptyObject',      () => expect(isTaskFunction({})).toBeFalsy())
    test('emptyArray',       () => expect(isTaskFunction([])).toBeFalsy())
    test('taskLikeObject',   () => expect(isTaskFunction(taskLikeObject)).toBeFalsy())
    test('taskFunction',     () => expect(isTaskFunction(taskFunction)).toBeTruthy())
    test('taskProvider',     () => expect(isTaskFunction(taskProvider)).toBeFalsy())
    test('namedTaskProvider',() => expect(isTaskFunction(namedTaskProvider)).toBeFalsy())
    test('progressInheritanceScale',  () => expect(isTaskFunction(pScale)).toBeFalsy())
    test('progressInheritanceOffset', () => expect(isTaskFunction(pOffset)).toBeFalsy())
    test('progressInheritanceRange',  () => expect(isTaskFunction(pRange)).toBeFalsy())
    test('threeNumberTuple',          () => expect(isTaskFunction(threeNumberTuple)).toBeFalsy())
})

describe('isTaskProvider', () => {
    test('undefined',        () => expect(isTaskProvider(undefined)).toBeFalsy())
    test('null',             () => expect(isTaskProvider(null)).toBeFalsy())
    test('emptyObject',      () => expect(isTaskProvider({})).toBeFalsy())
    test('emptyArray',       () => expect(isTaskProvider([])).toBeFalsy())
    test('taskLikeObject',   () => expect(isTaskProvider(taskLikeObject)).toBeFalsy())
    test('taskFunction',     () => expect(isTaskProvider(taskFunction)).toBeFalsy())
    test('taskProvider',     () => expect(isTaskProvider(taskProvider)).toBeTruthy())
    test('namedTaskProvider',() => expect(isTaskProvider(namedTaskProvider)).toBeTruthy())
    test('progressInheritanceScale',  () => expect(isTaskProvider(pScale)).toBeFalsy())
    test('progressInheritanceOffset', () => expect(isTaskProvider(pOffset)).toBeFalsy())
    test('progressInheritanceRange',  () => expect(isTaskProvider(pRange)).toBeFalsy())
    test('threeNumberTuple',          () => expect(isTaskProvider(threeNumberTuple)).toBeFalsy())
})

describe('isNamedTaskProvider', () => {
    test('undefined',        () => expect(isNamedTaskProvider(undefined)).toBeFalsy())
    test('null',             () => expect(isNamedTaskProvider(null)).toBeFalsy())
    test('emptyObject',      () => expect(isNamedTaskProvider({})).toBeFalsy())
    test('emptyArray',       () => expect(isNamedTaskProvider([])).toBeFalsy())
    test('taskLikeObject',   () => expect(isNamedTaskProvider(taskLikeObject)).toBeFalsy())
    test('taskFunction',     () => expect(isNamedTaskProvider(taskFunction)).toBeFalsy())
    test('taskProvider',     () => expect(isNamedTaskProvider(taskProvider)).toBeFalsy())
    test('namedTaskProvider',() => expect(isNamedTaskProvider(namedTaskProvider)).toBeTruthy())
    test('progressInheritanceScale',  () => expect(isNamedTaskProvider(pScale)).toBeFalsy())
    test('progressInheritanceOffset', () => expect(isNamedTaskProvider(pOffset)).toBeFalsy())
    test('progressInheritanceRange',  () => expect(isNamedTaskProvider(pRange)).toBeFalsy())
    test('threeNumberTuple',          () => expect(isNamedTaskProvider(threeNumberTuple)).toBeFalsy())
})

describe('isTaskDefinition', () => {
    test('undefined',        () => expect(isTaskDefinition(undefined)).toBeFalsy())
    test('null',             () => expect(isTaskDefinition(null)).toBeFalsy())
    test('emptyObject',      () => expect(isTaskDefinition({})).toBeFalsy())
    test('emptyArray',       () => expect(isTaskDefinition([])).toBeFalsy())
    test('taskLikeObject',   () => expect(isTaskDefinition(taskLikeObject)).toBeFalsy())
    test('taskFunction',     () => expect(isTaskDefinition(taskFunction)).toBeTruthy())
    test('taskProvider',     () => expect(isTaskDefinition(taskProvider)).toBeTruthy())
    test('namedTaskProvider',() => expect(isTaskDefinition(namedTaskProvider)).toBeTruthy())
    test('progressInheritanceScale',  () => expect(isTaskDefinition(pScale)).toBeFalsy())
    test('progressInheritanceOffset', () => expect(isTaskDefinition(pOffset)).toBeFalsy())
    test('progressInheritanceRange',  () => expect(isTaskDefinition(pRange)).toBeFalsy())
    test('threeNumberTuple',          () => expect(isTaskDefinition(threeNumberTuple)).toBeFalsy())
})

describe('isProgressInheritanceScale', () => {
    test('undefined',        () => expect(isProgressInheritanceScale(undefined)).toBeFalsy())
    test('null',             () => expect(isProgressInheritanceScale(null)).toBeFalsy())
    test('emptyObject',      () => expect(isProgressInheritanceScale({})).toBeFalsy())
    test('emptyArray',       () => expect(isProgressInheritanceScale([])).toBeFalsy())
    test('taskLikeObject',   () => expect(isProgressInheritanceScale(taskLikeObject)).toBeFalsy())
    test('taskFunction',     () => expect(isProgressInheritanceScale(taskFunction)).toBeFalsy())
    test('taskProvider',     () => expect(isProgressInheritanceScale(taskProvider)).toBeFalsy())
    test('namedTaskProvider',() => expect(isProgressInheritanceScale(namedTaskProvider)).toBeFalsy())
    test('progressInheritanceScale',  () => expect(isProgressInheritanceScale(pScale)).toBeTruthy())
    test('progressInheritanceOffset', () => expect(isProgressInheritanceScale(pOffset)).toBeFalsy())
    test('progressInheritanceRange',  () => expect(isProgressInheritanceScale(pRange)).toBeFalsy())
    test('threeNumberTuple',          () => expect(isProgressInheritanceScale(threeNumberTuple)).toBeFalsy())
})

describe('isProgressInheritanceOffset', () => {
    test('undefined',        () => expect(isProgressInheritanceOffset(undefined)).toBeFalsy())
    test('null',             () => expect(isProgressInheritanceOffset(null)).toBeFalsy())
    test('emptyObject',      () => expect(isProgressInheritanceOffset({})).toBeFalsy())
    test('emptyArray',       () => expect(isProgressInheritanceOffset([])).toBeFalsy())
    test('taskLikeObject',   () => expect(isProgressInheritanceOffset(taskLikeObject)).toBeFalsy())
    test('taskFunction',     () => expect(isProgressInheritanceOffset(taskFunction)).toBeFalsy())
    test('taskProvider',     () => expect(isProgressInheritanceOffset(taskProvider)).toBeFalsy())
    test('namedTaskProvider',() => expect(isProgressInheritanceOffset(namedTaskProvider)).toBeFalsy())
    test('progressInheritanceScale',  () => expect(isProgressInheritanceOffset(pScale)).toBeFalsy())
    test('progressInheritanceOffset', () => expect(isProgressInheritanceOffset(pOffset)).toBeTruthy())
    test('progressInheritanceRange',  () => expect(isProgressInheritanceOffset(pRange)).toBeFalsy())
    test('threeNumberTuple',          () => expect(isProgressInheritanceOffset(threeNumberTuple)).toBeFalsy())
})

describe('isProgressInheritanceRange', () => {
    test('undefined',        () => expect(isProgressInheritanceRange(undefined)).toBeFalsy())
    test('null',             () => expect(isProgressInheritanceRange(null)).toBeFalsy())
    test('emptyObject',      () => expect(isProgressInheritanceRange({})).toBeFalsy())
    test('emptyArray',       () => expect(isProgressInheritanceRange([])).toBeFalsy())
    test('taskLikeObject',   () => expect(isProgressInheritanceRange(taskLikeObject)).toBeFalsy())
    test('taskFunction',     () => expect(isProgressInheritanceRange(taskFunction)).toBeFalsy())
    test('taskProvider',     () => expect(isProgressInheritanceRange(taskProvider)).toBeFalsy())
    test('namedTaskProvider',() => expect(isProgressInheritanceRange(namedTaskProvider)).toBeFalsy())
    test('progressInheritanceScale',  () => expect(isProgressInheritanceRange(pScale)).toBeFalsy())
    test('progressInheritanceOffset', () => expect(isProgressInheritanceRange(pOffset)).toBeFalsy())
    test('progressInheritanceRange',  () => expect(isProgressInheritanceRange(pRange)).toBeTruthy())
    test('threeNumberTuple',          () => expect(isProgressInheritanceRange(threeNumberTuple)).toBeFalsy())
})

describe('isProgressInheritance', () => {
    test('undefined',        () => expect(isProgressInheritance(undefined)).toBeFalsy())
    test('null',             () => expect(isProgressInheritance(null)).toBeFalsy())
    test('emptyObject',      () => expect(isProgressInheritance({})).toBeFalsy())
    test('emptyArray',       () => expect(isProgressInheritance([])).toBeFalsy())
    test('taskLikeObject',   () => expect(isProgressInheritance(taskLikeObject)).toBeFalsy())
    test('taskFunction',     () => expect(isProgressInheritance(taskFunction)).toBeFalsy())
    test('taskProvider',     () => expect(isProgressInheritance(taskProvider)).toBeFalsy())
    test('namedTaskProvider',() => expect(isProgressInheritance(namedTaskProvider)).toBeFalsy())
    test('progressInheritanceScale',  () => expect(isProgressInheritance(pScale)).toBeTruthy())
    test('progressInheritanceOffset', () => expect(isProgressInheritance(pOffset)).toBeTruthy())
    test('progressInheritanceRange',  () => expect(isProgressInheritance(pRange)).toBeTruthy())
    test('threeNumberTuple',          () => expect(isProgressInheritance(threeNumberTuple)).toBeFalsy())
})
