/**
 * `ExecutionContext` that captures `waitUntil` work so a test can await it via
 * `settled()`. Background work started during a request is otherwise invisible,
 * which is how "fire and forget" bugs survive their own test suite.
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
	/** True after `abort` runs at least once. */
	readonly aborted: boolean;
	/** Reason given to the first `abort` call, or `undefined` when it was called without one. */
	readonly abortReason: unknown;

	/**
	 * Abandons the context, recording that it happened.
	 *
	 * Declared directly on this mock because generated worker types vary in
	 * whether `abort` exists yet, keeping the mock checkable either way.
	 * @param reason Cause supplied by the caller, absent when it aborted without one.
	 */
	abort(reason?: unknown): void;

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
 * Every `waitUntil` promise is kept so a test can await it through
 * {@link ExecutionContextMock.settled} and assert on what it wrote.
 * @param options Value to expose as `ctx.props`.
 * @returns An `ExecutionContext` with inspectable deferred work.
 * @example let ctx = createExecutionContext(); await handler(request, env, ctx); await ctx.settled();
 */
export function createExecutionContext<Props = unknown>(
	options?: ExecutionContextMockOptions<Props>,
): ExecutionContextMock<Props> {
	let promises: Promise<unknown>[] = [];
	let passedThrough = false;
	let aborted = false;
	let abortReason: unknown;

	return {
		get waitUntilPromises(): readonly Promise<unknown>[] {
			return [...promises];
		},

		get passedThroughOnException(): boolean {
			return passedThrough;
		},

		get aborted(): boolean {
			return aborted;
		},

		get abortReason(): unknown {
			return abortReason;
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

		/**
		 * Records that the handler abandoned the context.
		 *
		 * Aborting is terminal on the platform, so the reason from the first call
		 * persists through every later one.
		 * @param reason Cause supplied by the caller, absent when it aborted without one.
		 */
		abort(reason?: unknown): void {
			if (aborted) return;
			aborted = true;
			abortReason = reason;
		},

		async settled(): Promise<void> {
			let awaited = 0;

			while (awaited < promises.length) {
				let pending = promises.slice(awaited);
				awaited = promises.length;
				await Promise.all(pending);
			}
		},

		/**
		 * Exposes exactly the value the caller supplied, including `undefined` when
		 * omitted, since `props` is untyped at the platform boundary.
		 */
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
