import {CleanupTask, Task} from './Task'
import {
    CleanupInterruptionResult,
    CleanupProgressMessage, TaskDefinition,
    TaskEvents,
    TaskFunction, TaskInfo,
    TaskInterruptionFlag,
    TaskState
} from './types'
import TaskInterruptionError from './TaskInterruptionError'
import TaskContext from './utils/TaskContext'

export default class PreparedTask<TResult = any, TArgs extends any[] = [], PMessage = any, IResult = any> {

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- INITIALISATION ---------------------------------------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    original: Task<TResult, TArgs, PMessage, IResult>
    args: TArgs
    readonly [Symbol.toStringTag]: string

    constructor(
        task: Task<TResult, TArgs, PMessage, IResult>|TaskDefinition<TResult, TArgs, PMessage, IResult>,
        ...args: TArgs
    ) {
        this.original = task instanceof Task ? task : new Task(task)
        this.args = args
        this[Symbol.toStringTag] = `${this.constructor.name}[${this.name}]`
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENT: Task<TResult, TArgs, PMessage, IResult> ---------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    get taskSetup(): (task: Task<TResult, TArgs, PMessage, IResult>) => void {
        return this.original.taskSetup
    }

    // ------------------------------------------------------------------------------------------------------------ //
    // ---- IMPLEMENT: Task<TResult, [], PMessage, IResult> ------------------------------------------------------- //
    // ------------------------------------------------------------------------------------------------------------ //

    get name(): string {
        return this.original.name
    }

    assertState(...expectedStates: TaskState[]): void {
        this.original.assertState(...expectedStates)
    }

    catch<R = never>(onRejected?: ((reason: any) => (PromiseLike<R> | R)) | undefined | null): Promise<R | TResult> {
        return this.original.catch(onRejected)
    }

    get cleaned(): boolean {
        return this.original.cleaned
    }

    cleanup(): Task<void, [], CleanupProgressMessage, CleanupInterruptionResult> {
        return this.original.cleanup()
    }

    get cleanupTask(): TaskFunction<void, [], CleanupProgressMessage, CleanupInterruptionResult> {
        return this.original.cleanupTask
    }

    get cleanupTasks(): CleanupTask<TResult, TArgs, IResult>[] {
        return this.original.cleanupTasks
    }

    clearInterrupters(): this {
        this.original.clearInterrupters()
        return this
    }

    get currentProgress(): number {
        return this.original.currentProgress
    }

    deleteInterrupter(interrupter: (flag: TaskInterruptionFlag) => (Promise<IResult> | IResult)): boolean {
        return this.original.deleteInterrupter(interrupter)
    }

    emit<K extends keyof TaskEvents>(event: K, ...args: Parameters<TaskEvents[K]>): boolean
    emit(event: string|symbol, ...args: any[]): boolean
    emit(event: string|symbol, ...args: (any)[]): boolean {
        return this.original.emit(event, ...args)
    }

    emitLambda<K extends keyof TaskEvents>(event: K): TaskEvents[K]
    emitLambda(event: string | symbol): (...args: any[]) => boolean
    emitLambda(event: string | symbol): (...args: any[]) => boolean {
        return this.original.emitLambda(event)
    }

    eventIsNew(event: string | symbol): boolean {
        return this.original.eventIsNew(event)
    }

    eventNames(): (keyof TaskEvents | string | symbol)[]  {
        return this.original.eventNames()
    }

    get events(): (string | symbol)[] {
        return this.original.events
    }

    get failedSubTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.original.failedSubTasks
    }

    get failureReason(): any | undefined {
        return this.original.failureReason
    }

    finally(onFinally?: (() => void) | undefined | null): Promise<TResult> {
        return this.original.finally(onFinally)
    }

    get finishedSubTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.original.finishedSubTasks
    }

    getMaxListeners(): number {
        return this.original.getMaxListeners()
    }

    getSubTaskTree(prefix?: number | string, indent?: number, indentString?: string, nameWidth?: number): string {
        return this.original.getSubTaskTree(prefix, indent, indentString, nameWidth)
    }

    getTaskInfo(): TaskInfo<TResult, TArgs, PMessage, IResult> {
        return this.original.getTaskInfo()
    }

    interrupt(flag?: TaskInterruptionFlag): Promise<IResult | null> {
        return this.original.interrupt(flag)
    }

    get interruptedSubTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.original.interruptedSubTasks
    }

    get interruptionError(): TaskInterruptionError<IResult> | undefined {
        return this.original.interruptionError
    }

    get interruptionResult(): IResult | undefined {
        return this.original.interruptionResult
    }

    get isFailed(): boolean {
        return this.original.isFailed
    }

    get isFinished(): boolean {
        return this.original.isFinished
    }

    get isInterrupted(): boolean {
        return this.original.isInterrupted
    }

    get isReady(): boolean {
        return this.original.isReady
    }

    get isRootTask(): boolean {
        return this.original.isRootTask
    }

    get isRunning(): boolean {
        return this.original.isRunning
    }

    get isSubTask(): boolean {
        return this.original.isSubTask
    }

    get isSucceeded(): boolean {
        return this.original.isSucceeded
    }

    get lastProgressMessage(): PMessage | undefined {
        return this.original.lastProgressMessage
    }

    listenerCount<K extends keyof TaskEvents>(event: K): number
    listenerCount(event: string | symbol): number
    listenerCount(event: string | symbol): number {
        return this.original.listenerCount(event)
    }

    listeners<K extends keyof TaskEvents>(event: K): Function[]
    listeners(event: string | symbol): Function[]
    listeners(event: string | symbol): Function[] {
        return this.original.listeners(event)
    }

    off<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    off(event: string | symbol, listener: (...args: any[]) => void): this
    off(event: string | symbol, listener: (...args: any[]) => void): this {
        this.original.off(event, listener)
        return this
    }

    on<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    on(event: string | symbol, listener: (...args: any[]) => void): this
    on(event: string | symbol, listener: (...args: any[]) => void): this {
        this.original.on(event, listener)
        return this
    }

    once<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    once(event: string | symbol, listener: (...args: any[]) => void): this
    once(event: string | symbol, listener: (...args: any[]) => void): this {
        this.original.once(event, listener)
        return this
    }

    get parentTask(): Task<any, any[], PMessage, IResult> | null {
        return this.original.parentTask
    }

    prependListener<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    prependListener(event: string | symbol, listener: (...args: any[]) => void): this
    prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
        this.original.prependListener(event, listener)
        return this
    }

    prependOnceListener<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this
    prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
        this.original.prependOnceListener(event, listener)
        return this
    }

    get progressFraction(): number | undefined {
        return this.original.progressFraction
    }

    get progressThrottle(): number {
        return this.original.progressThrottle
    }

    rawListeners<K extends keyof TaskEvents>(event: K): Function[]
    rawListeners(event: string | symbol): Function[]
    rawListeners(event: string | symbol): Function[] {
        return this.original.rawListeners(event)
    }

    get readySubTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.original.readySubTasks
    }

    registerEvent(event: string | symbol): this {
        this.original.registerEvent(event)
        return this
    }

    reject(reason: any): void {
        this.original.reject(reason)
    }

    removeAllListeners<K extends keyof TaskEvents>(event?: K): this
    removeAllListeners(event?: string | symbol): this
    removeAllListeners(event?: string | symbol): this {
        this.original.removeAllListeners(event)
        return this
    }

    removeListener<K extends keyof TaskEvents>(event: K, listener: TaskEvents[K]): this
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
        this.original.removeListener(event, listener)
        return this
    }

    resolve(result: TResult): void {
        this.original.resolve(result)
    }

    get result(): TResult | undefined {
        return this.original.result
    }

    run(): Task<TResult, TArgs, PMessage, IResult> {
        return this.original.run(...this.args)
    }

    get runningSubTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.original.runningSubTasks
    }

    setMaxListeners(n: number): this {
        this.original.setMaxListeners(n)
        return this
    }

    setProgressThrottle(delay: number): this {
        this.original.setProgressThrottle(delay)
        return this
    }

    softInterrupt(interruptResult: IResult): void {
        return this.original.softInterrupt(interruptResult)
    }

    get state(): TaskState {
        return this.original.state
    }

    get subTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.original.subTasks
    }

    get succeededSubTasks(): Task<any, any[], PMessage, IResult>[] {
        return this.original.succeededSubTasks
    }

    task(context: TaskContext<TResult, [], PMessage, IResult>): Promise<TResult> | TResult | void {
        return context.runSubTask(this.original, ...this.args)
    }

    get taskName(): string {
        return this.original.taskName
    }

    then<R1 = TResult, R2 = never>(
        onFulfilled?: ((value: TResult) => (PromiseLike<R1> | R1)) | undefined | null,
        onRejected?: ((reason: any) => (PromiseLike<R2> | R2)) | undefined | null
    ): Promise<R1 | R2> {
        return this.original.then(onFulfilled, onRejected)
    }

    toJSON(): object {
        return this.getTaskInfo()
    }

    get totalProgress(): number | undefined {
        return this.original.totalProgress
    }

    prepare(): this {
        return this
    }

}
