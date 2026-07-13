/**
 * Client-side cache of in-flight `Frame` prefetch requests, keyed by `src` URL.
 * `prefetchFrame` is meant to be called from a hover/focus listener on a
 * Frame-targeted link; `consumePrefetchedFrame` is called by
 * `bootstrap/browser.ts`'s `resolveFrame` so a click that follows a hover reuses the
 * already-started fetch instead of issuing a second one. No top-level side effects —
 * safe to import from a component that also renders during SSR.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const cache = new Map<string, Promise<Response>>();

/** How long a prefetched response stays claimable if the link is never clicked. */
const PREFETCH_TTL_MS = 10_000;

/** Starts a prefetch fetch for `src`, unless one is already in flight. */
export function prefetchFrame(src: string, target?: string): void {
	if (cache.has(src)) return;

	let headers = new Headers({ accept: "text/html" });
	if (target) headers.set("x-remix-target", target);

	let promise = fetch(src, { credentials: "same-origin", headers });
	cache.set(src, promise);
	promise.catch(() => cache.delete(src));
	setTimeout(() => cache.delete(src), PREFETCH_TTL_MS);
}

/** Removes and returns the pending prefetch for `src`, if one exists. */
export function consumePrefetchedFrame(src: string): Promise<Response> | undefined {
	let promise = cache.get(src);
	if (promise) cache.delete(src);
	return promise;
}
