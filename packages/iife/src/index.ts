/**
 * Evaluates inline logic and returns its result where an expression is needed.
 *
 * @example iife(() => 2 + 2)
 * @example iife(() => <>{isLoading ? <Spinner /> : <Content />}</>)
 * @example await iife(async () => fetchUser(id))
 */
export function iife<T>(fn: () => T): T {
	return fn();
}
