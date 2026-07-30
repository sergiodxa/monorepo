/**
 * `ExecutionContext` that records `waitUntil` work instead of discarding it, with an
 * awaitable `settled()`. Background work started during a request is otherwise invisible
 * to a test, which is how "fire and forget" bugs survive their own test suite.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** Options for {@link createExecutionContext}. */
export interface ExecutionContextMockOptions<Props> {
	/** Value exposed as `ctx.props`, for handlers that read caller-supplied props. */
	props?: Props;
}

/** An `ExecutionContext` whose deferred work can be awaited and inspected. */
export interface ExecutionContextMock<Props = unknown> extends ExecutionContext<Props> {
	/** Promises handed to `waitUntil`, in registration order. */
	readonly waitUntilPromises: readonly Promise<unknown>[];
	/** Whether the handler asked to pass exceptions through to the origin. */
	readonly passedThroughOnException: boolean;

	/**
	 * Awaits every registered promise, including ones registered while awaiting, so a
	 * chain of background work is fully drained.
	 * @throws The first rejection, so failed background work fails the test.
	 */
	settled(): Promise<void>;
}

/**
 * Creates an execution context that captures deferred work.
 *
 * Nothing is swallowed: `waitUntil` promises are kept so a test can await them through
 * {@link ExecutionContextMock.settled} and assert on whatever they wrote.
 * @param options Value to expose as `ctx.props`.
 * @returns An `ExecutionContext` with inspectable deferred work.
 * @example let ctx = createExecutionContext(); await handler(request, env, ctx); await ctx.settled();
 */
export function createExecutionContext<Props = unknown>(
	options?: ExecutionContextMockOptions<Props>,
): ExecutionContextMock<Props> {
	let promises: Promise<unknown>[] = [];
	let passedThrough = false;

	return {
		get waitUntilPromises(): readonly Promise<unknown>[] {
			return [...promises];
		},

		get passedThroughOnException(): boolean {
			return passedThrough;
		},

		/**
		 * Registers background work to be awaited later.
		 * @param promise Work that must finish after the response is returned.
		 */
		waitUntil(promise: Promise<unknown>): void {
			promises.push(promise);
		},

		/** Records that the handler opted into passing exceptions through. */
		passThroughOnException(): void {
			passedThrough = true;
		},

		async settled(): Promise<void> {
			let awaited = 0;

			while (awaited < promises.length) {
				let pending = promises.slice(awaited);
				awaited = promises.length;
				await Promise.all(pending);
			}
		},

		// `props` is untyped at the platform boundary and has no meaningful default, so an
		// omitted value stands in as-is rather than being invented.
		props: options?.props as Props,

		/** Rejects access to the RPC entrypoints, which have no in-memory equivalent. */
		get exports(): Cloudflare.Exports {
			throw new Error("ExecutionContext.exports is not implemented by @pkg/cloudflare-mocks");
		},

		/** Rejects access to tracing, which has no in-memory equivalent. */
		get tracing(): Tracing {
			throw new Error("ExecutionContext.tracing is not implemented by @pkg/cloudflare-mocks");
		},
	};
}
