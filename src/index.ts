
import TaskInterruptionError from './TaskInterruptionError'
import Facade from './Facade'

const task = new Facade()

export default task
export * from './Task'
export {default as ChildProcess} from './ChildProcess'
export {default as Command} from './Command'
export * from './types'
export { TaskInterruptionError }
export * from './templates'
export * from './utils'
export * from './factories'
