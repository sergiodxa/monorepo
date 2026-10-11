/**
 * Marks a tool or resource implementation as a module imported on first use. A Worker
 * then starts without the code behind every tool, and the first request that needs one
 * pays for its import once per isolate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Brands a loader so `map()` can tell it from a handler, both being plain functions. */
const LAZY = Symbol.for("@sdxc/mcp.lazy");

/** An implementation that arrives as the default export of a module imported on demand. */
export interface Lazy<Target> {
	readonly [LAZY]: true;
	/** Imports the module. Call it through {@link once} so one isolate imports it once. */
	readonly load: () => Promise<{ default: Target }>;
}

/**
 * Wraps a dynamic import so `map()` defers it to the first request that needs the module.
 *
 * The module default-exports what `createTool`, `createToolController` or `createResource`
 * returns, so the declaration stays typed while its code stays out of startup.
 *
 * @param load A function returning the module's `import()`.
 * @returns A binding `tools.map` and `resources.map` accept wherever they take an implementation.
 * @example
 * mcp.tools.map(toolset.searchPosts, lazy(() => import("./tools/search-posts")));
 */
export function lazy<Target>(load: () => Promise<{ default: Target }>): Lazy<Target> {
	return { [LAZY]: true, load };
}

/** Reports whether a `map()` argument was wrapped by {@link lazy}. */
export function isLazy(value: unknown): value is Lazy<unknown> {
	return typeof value === "object" && value !== null && LAZY in value;
}

/**
 * Resolves a binding to its implementation, importing a lazy one at most once.
 *
 * The in-flight promise is what is cached, so concurrent requests share one import; a
 * failed import is dropped, leaving the next request to retry it.
 *
 * @param binding The implementation, or the lazy wrapper around it.
 * @returns A function answering with the implementation every time it is called.
 */
export function once<Target>(binding: Target | Lazy<Target>): () => Promise<Target> {
	if (!isLazy(binding)) return () => Promise.resolve(binding as Target);

	let loading: Promise<Target> | undefined;
	return () => {
		if (loading === undefined) {
			loading = binding.load().then(
				(module) => module.default as Target,
				(error: unknown) => {
					loading = undefined;
					throw error;
				},
			);
		}
		return loading;
	};
}
