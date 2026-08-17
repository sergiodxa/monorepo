/**
 * Corrects the `bun:test` declarations for the asynchronous matcher chains. `resolves` and
 * `rejects` are declared as the synchronous `Matchers`, whose assertions return `void`, but at
 * runtime every assertion on those chains returns a promise that the caller has to await.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
declare module "bun:test" {
	/** The matcher set of an async chain, with every assertion returning the promise it really is. */
	type AsyncMatchers<T> = {
		[Key in keyof MatchersBuiltin<T>]: MatchersBuiltin<T>[Key] extends (...args: infer Args) => void
			? (...args: Args) => Promise<void>
			: MatchersBuiltin<T>[Key];
	};

	interface Matchers<T> {
		resolves: AsyncMatchers<Awaited<T>>;
		rejects: AsyncMatchers<unknown>;
	}
}

export {};
