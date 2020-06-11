import TriggerableTaskTemplate from '../../../src/templates/TriggerableTaskTemplate'
import {isNamedTaskProvider, isTaskDefinition, isTaskProvider} from '../../../src/utils'

describe('TriggerableTaskTemplate', () => {

    test('Nameless initialisation', () => {
        const task = new TriggerableTaskTemplate()
        expect(task.taskName).toBeUndefined()
        expect(isTaskDefinition(task)).toBeTruthy()
        expect(isTaskProvider(task)).toBeTruthy()
        expect(isNamedTaskProvider(task)).toBeFalsy()
    })

    test('Named initialisation', () => {
        const task = new TriggerableTaskTemplate('TaskName')
        expect(task.taskName).toBe('TaskName')
        expect(isTaskDefinition(task)).toBeTruthy()
        expect(isTaskProvider(task)).toBeTruthy()
        expect(isNamedTaskProvider(task)).toBeTruthy()
    })

})
