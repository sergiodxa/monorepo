/**
 * `OfflineCache`: the service worker's cache of a novel's files. It answers only the files the
 * page declared and the scene module chunks the app names, stores each as it is first fetched,
 * keeps content-hashed files cache-first and revalidates the rest, and holds a size budget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CachedEntry, Strategy } from "./policy.js";

import {
	cacheName,
	evict,
	INDEX_PATH,
	isHashed,
	staleCaches,
	strategyFor,
	undeclared,
} from "./policy.js";

/** How the worker caches a novel's files. */
export interface OfflineOptions {
	/**
	 * The app's build version. Files live in a cache named after it, and activating a worker of a
	 * new version deletes the caches of every other one.
	 */
	version: string;
	/** The most bytes to keep; past it the least recently used files are deleted. */
	budget?: number;
	/**
	 * Reports whether a URL is a scene module chunk to cache, such as the chunks Vite's
	 * `chunkFileNames` puts under `/assets/scenes/`.
	 *
	 * @default no module is cached
	 */
	modules?: (url: URL) => boolean;
	/**
	 * Reports whether a URL is content-hashed, which makes it cache-first.
	 *
	 * @default `isHashed`, a Vite build's `/assets/<name>-<hash>.<ext>`
	 */
	immutable?: (url: URL) => boolean;
}

/** What the cache keeps beside the files: the declared URLs and each file's size and last use. */
interface CacheIndex {
	declared: string[];
	entries: CachedEntry[];
}

/**
 * A novel's files in one versioned cache. Bookkeeping runs one change at a time, so concurrent
 * fetches never lose an entry, and survives the worker being stopped between events.
 */
export class OfflineCache {
	#caches: CacheStorage;
	#origin: string;
	#options: OfflineOptions;
	#index: CacheIndex | undefined;
	#loading: Promise<CacheIndex> | undefined;
	#queue: Promise<unknown> = Promise.resolve();

	/**
	 * Creates the cache over a `CacheStorage`; {@link serveOffline} builds one for the worker.
	 *
	 * @param caches - The worker's `caches`.
	 * @param origin - The worker's origin, which declared paths resolve against.
	 * @param options - The version, budget and URL rules.
	 */
	constructor(caches: CacheStorage, origin: string, options: OfflineOptions) {
		this.#caches = caches;
		this.#origin = origin;
		this.#options = options;
	}

	/**
	 * Records the files the novel declares and deletes cached files it no longer declares, such
	 * as an older build's hashed URLs.
	 *
	 * @param urls - The declared URLs, absolute or relative to the origin.
	 */
	declare(urls: readonly string[]): Promise<void> {
		return this.#change(async (index, cache) => {
			index.declared = [...new Set(urls.map((url) => new URL(url, this.#origin).href))];
			let gone = new Set(
				undeclared(index.entries, new Set(index.declared), (url) => this.#isModule(url)),
			);
			await Promise.all([...gone].map((url) => cache.delete(url)));
			index.entries = index.entries.filter((entry) => !gone.has(entry.url));
		});
	}

	/**
	 * Deletes the caches of every other version, which a new worker does when it activates.
	 *
	 * @returns The deleted cache names.
	 */
	async activate(): Promise<string[]> {
		let stale = staleCaches(await this.#caches.keys(), this.#options.version);
		await Promise.all(stale.map((name) => this.#caches.delete(name)));
		return stale;
	}

	/**
	 * Answers a request the cache owns, or leaves it alone. The answer is known at once for a
	 * navigation, a non-`GET` or a module chunk; before the declared URLs are read back after a
	 * restart, a pending request is answered, and passed to the network if it is not declared.
	 *
	 * @param request - The fetched request.
	 * @param waitUntil - Keeps the worker alive for bookkeeping that runs after the response.
	 * @returns The response to answer with, or `undefined` to let the request through.
	 */
	handle(
		request: Request,
		waitUntil: (work: Promise<unknown>) => void,
	): Promise<Response> | undefined {
		if (this.#index !== undefined) {
			let strategy = this.#strategy(request, this.#index);
			return strategy === "pass" ? undefined : this.#answer(request, strategy, waitUntil);
		}
		let early = this.#strategy(request, { declared: [], entries: [] });
		if (early !== "pass") return this.#answer(request, early, waitUntil);
		if (request.method !== "GET" || request.mode === "navigate") return undefined;
		return this.#load().then((index) => {
			let strategy = this.#strategy(request, index);
			return strategy === "pass" ? fetch(request) : this.#answer(request, strategy, waitUntil);
		});
	}

	/** The cached files, for a test or a page that shows how much a novel stores. */
	async entries(): Promise<CachedEntry[]> {
		return [...(await this.#load()).entries];
	}

	/** How the policy answers a request with the given index. */
	#strategy(request: Request, index: CacheIndex): Strategy {
		return strategyFor(request, {
			declared: new Set(index.declared),
			modules: (url) => this.#isModule(url),
			immutable: this.#options.immutable ?? isHashed,
		});
	}

	/** Serves a file by its strategy, storing what the network answers. */
	async #answer(
		request: Request,
		strategy: Exclude<Strategy, "pass">,
		waitUntil: (work: Promise<unknown>) => void,
	): Promise<Response> {
		let url = new URL(request.url);
		url.hash = "";
		let cache = await this.#caches.open(cacheName(this.#options.version));
		if (strategy === "cache-first") {
			let cached = await cache.match(url.href);
			if (cached !== undefined) {
				waitUntil(this.#touch(url.href));
				return cached;
			}
			let response = await fetch(request);
			if (storable(request, response)) waitUntil(this.#store(url.href, response.clone()));
			return response;
		}
		let response: Response;
		try {
			response = await fetch(new Request(request, { cache: "no-cache" }));
		} catch (error) {
			let cached = await cache.match(url.href);
			if (cached === undefined) throw error;
			waitUntil(this.#touch(url.href));
			return cached;
		}
		if (storable(request, response)) waitUntil(this.#store(url.href, response.clone()));
		return response;
	}

	/** Stores a fetched file, records its size and use, and evicts past the budget. */
	#store(url: string, response: Response): Promise<void> {
		return this.#change(async (index, cache) => {
			let body = await response.clone().blob();
			await cache.put(url, response);
			index.entries = [
				...index.entries.filter((entry) => entry.url !== url),
				{ url, size: body.size, used: clock(index) },
			];
			let evicted = new Set(evict(index.entries, this.#options.budget, url));
			await Promise.all([...evicted].map((entry) => cache.delete(entry)));
			index.entries = index.entries.filter((entry) => !evicted.has(entry.url));
		});
	}

	/** Marks a file as just used, so eviction keeps it longer. */
	#touch(url: string): Promise<void> {
		return this.#change(async (index) => {
			let entry = index.entries.find((candidate) => candidate.url === url);
			if (entry !== undefined) entry.used = clock(index);
		});
	}

	/** Runs one bookkeeping change after the previous one, then writes the index back. */
	#change(work: (index: CacheIndex, cache: Cache) => Promise<void>): Promise<void> {
		let next = this.#queue.then(async () => {
			let index = await this.#load();
			let cache = await this.#caches.open(cacheName(this.#options.version));
			await work(index, cache);
			await cache.put(this.#indexUrl(), Response.json(index));
		});
		this.#queue = next.catch(() => undefined);
		return next;
	}

	/** Reads the index back from the cache once, starting empty for a new version. */
	#load(): Promise<CacheIndex> {
		this.#loading ??= this.#caches
			.open(cacheName(this.#options.version))
			.then((cache) => cache.match(this.#indexUrl()))
			.then(async (stored) => {
				let parsed: unknown = stored === undefined ? undefined : await stored.json();
				this.#index = isIndex(parsed) ? parsed : { declared: [], entries: [] };
				return this.#index;
			});
		return this.#loading;
	}

	/** Where the index is kept in the cache. */
	#indexUrl(): string {
		return new URL(INDEX_PATH, this.#origin).href;
	}

	/** Reports whether a URL is a scene module chunk by the app's rule. */
	#isModule(url: URL): boolean {
		return this.#options.modules?.(url) ?? false;
	}
}

/**
 * Reports whether a response can be stored: a whole `200` to a request without a range, since a
 * partial or opaque response says nothing about the full file.
 */
function storable(request: Request, response: Response): boolean {
	return response.status === 200 && response.type !== "opaque" && !request.headers.has("range");
}

/** The next use stamp, one past the newest entry, so order survives a restart. */
function clock(index: CacheIndex): number {
	return index.entries.reduce((latest, entry) => Math.max(latest, entry.used), 0) + 1;
}

/** Reports whether stored JSON is an index, which a version's first start lacks. */
function isIndex(value: unknown): value is CacheIndex {
	if (typeof value !== "object" || value === null) return false;
	let candidate = value as Partial<CacheIndex>;
	return Array.isArray(candidate.declared) && Array.isArray(candidate.entries);
}
