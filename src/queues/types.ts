// -------------------------------------------------------------------------------------------------------------- //
//   Queues                                                                                                       //
// -------------------------------------------------------------------------------------------------------------- //

export interface Queue<TResult = any, TArgs extends any[] = any[], PMessage = any, IResult = any> {
    process(processor: QueueProcessor<TResult, TArgs, PMessage, IResult>): void
}

// -------------------------------------------------------------------------------------------------------------- //
//   Queue Processor                                                                                              //
// -------------------------------------------------------------------------------------------------------------- //

export type QueueProcessor<TResult = any, TArgs extends any[] = any[], PMessage = any, IResult = any> =
    (job: JobDescription<TResult, TArgs, PMessage, IResult>) => Promise<TResult>

// -------------------------------------------------------------------------------------------------------------- //
//   Jobs                                                                                                         //
// -------------------------------------------------------------------------------------------------------------- //

export interface JobDescription<TResult = any, TArgs extends any[] = any[], PMessage = any, IResult = any> {
    id: string
    args: TArgs
}

export interface Job<TResult = any, TArgs extends any[] = any[], PMessage = any, IResult = any> {
    id: string
    args: TArgs
    setProgress(current: number, total?: number, message?: PMessage): void
    getProgress(): Promise<{current: number, total?: number, message?: PMessage}>
    remove(): Promise<void>
    retry(): Promise<void>
    finished(): Promise<TResult>
}
