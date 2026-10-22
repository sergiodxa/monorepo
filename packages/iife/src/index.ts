/**
 * Runs a callback immediately and returns its result, so block-style control flow
 * can sit where JavaScript only accepts an expression — assignments, JSX, and
 * object fields — without an outer mutable binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Evaluates `fn` and returns whatever it returns, including a promise when `fn`
 * is async.
 *
 * Prefer this over an outer `let` filled by `if`/`else` when the whole block
 * exists to compute one value.
 *
 * @param fn - Callback with the inline logic to evaluate.
 * @returns The callback's result.
 * @example iife(() => { if (n < 0) return 0; return n; })
 * @example await iife(async () => (await fetch(url)).json())
 */
export function iife<T>(fn: () => T): T {
	return fn();
}
