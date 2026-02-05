export interface Job {
	run(message: Message, ctx: ExecutionContext): Promise<void>;
}
