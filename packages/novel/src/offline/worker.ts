/**
 * The `@sdxc/novel/offline/worker` entry: `serveOffline()`, called once at the top of the app's
 * own worker script, wires install, activation, the page's message with the declared URLs, and
 * fetches to an `OfflineCache`. It imports nothing but the platform and the cache policy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OfflineOptions } from "./cache.js";

import { OfflineCache } from "./cache.js";
import { ASSETS_MESSAGE } from "./policy.js";

export type { OfflineOptions } from "./cache.js";
export type { CachedEntry, PolicyInput, PolicyRequest, Strategy } from "./policy.js";

export { OfflineCache } from "./cache.js";
export {
	ASSETS_MESSAGE,
	cacheName,
	evict,
	isHashed,
	staleCaches,
	strategyFor,
	undeclared,
} from "./policy.js";

/** An event a worker keeps itself alive for. */
interface WaitingEvent {
	waitUntil(work: Promise<unknown>): void;
}

/** The parts of a service worker's `fetch` event the cache reads. */
interface FetchEventLike extends WaitingEvent {
	readonly request: Request;
	respondWith(response: Promise<Response>): void;
}

/** The parts of a service worker's `message` event the cache reads. */
interface MessageEventLike extends WaitingEvent {
	readonly data: unknown;
}

/** The parts of `ServiceWorkerGlobalScope` the worker uses. */
interface WorkerScope {
	readonly caches: CacheStorage;
	readonly location: { readonly origin: string };
	readonly clients: { claim(): Promise<void> };
	skipWaiting(): Promise<void>;
	addEventListener(type: string, listener: (event: never) => void): void;
}

/**
 * Turns the current service worker into the novel's offline cache. A new version takes over at
 * once and deletes the caches of older ones as it activates; files are stored as the game
 * first fetches them, never all at install.
 *
 * @param options - The build version, an optional size budget, and which URLs are scene module
 * chunks and which are content-hashed.
 * @returns The cache, for a worker that also wants to read its entries.
 * @example serveOffline({ version: BUILD_ID, budget: 200_000_000, modules: (url) => url.pathname.startsWith("/assets/scenes/") });
 */
export function serveOffline(options: OfflineOptions): OfflineCache {
	let scope = globalThis as unknown as WorkerScope;
	let cache = new OfflineCache(scope.caches, scope.location.origin, options);
	scope.addEventListener("install", (event: WaitingEvent) => {
		event.waitUntil(scope.skipWaiting());
	});
	scope.addEventListener("activate", (event: WaitingEvent) => {
		event.waitUntil(cache.activate().then(() => scope.clients.claim()));
	});
	scope.addEventListener("message", (event: MessageEventLike) => {
		let urls = declaredUrls(event.data);
		if (urls !== undefined) event.waitUntil(cache.declare(urls));
	});
	scope.addEventListener("fetch", (event: FetchEventLike) => {
		let response = cache.handle(event.request, (work) => event.waitUntil(work));
		if (response !== undefined) event.respondWith(response);
	});
	return cache;
}

/**
 * Reads the declared URLs from a page's message.
 *
 * @param data - What the page posted.
 * @returns The URLs, or `undefined` for any other message.
 */
export function declaredUrls(data: unknown): string[] | undefined {
	if (typeof data !== "object" || data === null) return undefined;
	let message = data as { type?: unknown; urls?: unknown };
	if (message.type !== ASSETS_MESSAGE || !Array.isArray(message.urls)) return undefined;
	return message.urls.filter((url): url is string => typeof url === "string");
}
