/**
 * Marks a scene module as imported on first use, so a novel starts without the directives of
 * every scene it can reach and a scene's first play pays for its import once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Brands a loader so `map()` can tell it from a module it holds directly. */
const LAZY = Symbol.for("@sdxc/novel.lazy");

/**
 * A scene module that arrives as the default export of a module imported on demand.
 *
 * @template Target - What the module default-exports.
 */
export interface Lazy<Target> {
	readonly [LAZY]: true;
	/** Imports the module; the novel calls it once and shares the result. */
	readonly load: () => Promise<{ default: Target }>;
}

/**
 * Wraps a dynamic import so `map()` defers it to the first time a play reaches the scene.
 *
 * @param load - A function returning the module's `import()`; the module default-exports what `createScene()` returns.
 * @returns A binding `novel.map()` accepts wherever it takes a scene module.
 * @example novel.map(scenes.prologue.opening, lazy(() => import("~/novel/scenes/prologue/opening")));
 */
export function lazy<Target>(load: () => Promise<{ default: Target }>): Lazy<Target> {
	return { [LAZY]: true, load };
}

/**
 * Reports whether a `map()` argument was wrapped by {@link lazy}.
 *
 * @param value - What `map()` received.
 * @returns `true` for a lazy module.
 */
export function isLazy(value: unknown): value is Lazy<unknown> {
	return typeof value === "object" && value !== null && LAZY in value;
}
