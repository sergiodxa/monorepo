/**
 * Marks a command's implementation as a module imported on first use, so a run imports only
 * the handler it reaches and `--help` imports none.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Brands a loader so `map()` can tell it from a handler, both being plain functions. */
const LAZY = Symbol.for("@sdxc/cli.lazy");

/** An implementation that arrives as the default export of a module imported on demand. */
export interface Lazy<Target> {
	readonly [LAZY]: true;
	readonly load: () => Promise<{ default: Target }>;
}

/**
 * Wraps a dynamic import so `map()` defers it to the run that needs the module, which
 * default-exports what `createCommand` returns.
 *
 * @param load - A function returning the module's `import()`
 * @example cli.map(sdxc.ui.add, lazy(() => import("./commands/ui/add.js")));
 */
export function lazy<Target>(load: () => Promise<{ default: Target }>): Lazy<Target> {
	return { [LAZY]: true, load };
}

/** Whether a `map()` argument was wrapped by {@link lazy}. */
export function isLazy(value: unknown): value is Lazy<unknown> {
	return typeof value === "object" && value !== null && LAZY in value;
}
