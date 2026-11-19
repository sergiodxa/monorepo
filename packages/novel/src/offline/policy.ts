/**
 * The offline cache's rules as pure functions: which requests the worker answers and how, what
 * a cache is named for a version, which caches an activation clears, and which entries a size
 * budget evicts. The service worker and its tests share them, so the policy is tested apart from
 * any browser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Every cache the worker opens starts with this, so activation never touches an app's own caches. */
export const CACHE_PREFIX = "sdxc-novel:";

/**
 * The synthetic URL path the worker keeps its bookkeeping under (the declared URLs and each
 * entry's size and last use), inside its own cache.
 */
export const INDEX_PATH = "/__sdxc-novel-offline__/index.json";

/** The message type a page sends the declared URLs with. */
export const ASSETS_MESSAGE = "sdxc-novel:assets";

/**
 * A Vite build's content-hashed file under `/assets/`: a name, a dash, an eight-character hash
 * and an extension, as in `/assets/cafe-a1B2_c3D.webp`.
 */
const HASHED = /^\/assets\/(?:.+\/)?[^/]+-[\w-]{8}\.[a-z\d]+$/i;

/**
 * How the worker answers a request: `cache-first` for a content-hashed file, which never
 * changes under its URL; `revalidate` for any other declared file, fetched from the network
 * first and served from the cache only when the network fails; `pass` leaves the request alone.
 */
export type Strategy = "cache-first" | "revalidate" | "pass";

/** What the worker knows when it decides how to answer a request. */
export interface PolicyInput {
	/** The declared file URLs, absolute. */
	declared: ReadonlySet<string>;
	/** Reports whether a URL is a scene module chunk the worker may cache. */
	modules: (url: URL) => boolean;
	/** Reports whether a URL is content-hashed, so its contents never change. */
	immutable: (url: URL) => boolean;
}

/** The request fields the policy reads, which `Request` has. */
export interface PolicyRequest {
	url: string;
	method: string;
	mode: string;
	destination: string;
}

/**
 * Reports whether a URL is a content-hashed file from a Vite build, the default for
 * `serveOffline({ immutable })`. A file from `public/` keeps its own name and is revalidated.
 *
 * @param url - The file's URL.
 * @returns True for `/assets/<name>-<8-character hash>.<ext>`.
 * @example isHashed(new URL("https://game.example/assets/cafe-a1b2c3d4.webp")); // true
 */
export function isHashed(url: URL): boolean {
	return HASHED.test(url.pathname);
}

/**
 * Decides how the worker answers a request. Only a `GET` for a declared file or a scene module
 * chunk is answered; navigations and documents (HTML and app routes) always pass through.
 *
 * @param request - The request.
 * @param input - The declared URLs and the module and immutability rules.
 * @returns The strategy.
 */
export function strategyFor(request: PolicyRequest, input: PolicyInput): Strategy {
	if (request.method !== "GET") return "pass";
	if (request.mode === "navigate" || request.destination === "document") return "pass";
	let url = new URL(request.url);
	url.hash = "";
	if (!input.declared.has(url.href) && !input.modules(url)) return "pass";
	return input.immutable(url) ? "cache-first" : "revalidate";
}

/**
 * The name of the cache a version's files live in.
 *
 * @param version - The app's build version, as `serveOffline({ version })` names it.
 * @returns `sdxc-novel:<version>`.
 */
export function cacheName(version: string): string {
	return `${CACHE_PREFIX}${version}`;
}

/**
 * The caches an activation deletes: every cache of an older version, never the current one or
 * a cache the worker did not open.
 *
 * @param names - Every cache name the origin holds.
 * @param version - The activating worker's version.
 * @returns The names to delete.
 */
export function staleCaches(names: readonly string[], version: string): string[] {
	let current = cacheName(version);
	return names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== current);
}

/** A cached file as the worker's index records it. */
export interface CachedEntry {
	url: string;
	/** Bytes. */
	size: number;
	/** When the file was last stored or served, as a counter or a timestamp; higher is newer. */
	used: number;
}

/**
 * Picks the entries to delete so the cache fits a size budget, least recently used first. The
 * entry just stored is kept even when it alone exceeds the budget, so the file the page asked
 * for is still served.
 *
 * @param entries - Every cached file.
 * @param budget - The most bytes to keep; `undefined` keeps everything.
 * @param keep - The URL just stored.
 * @returns The URLs to delete, oldest first.
 * @example evict([{ url: "/a", size: 6, used: 1 }, { url: "/b", size: 6, used: 2 }], 10, "/b"); // ["/a"]
 */
export function evict(
	entries: readonly CachedEntry[],
	budget: number | undefined,
	keep?: string,
): string[] {
	if (budget === undefined) return [];
	let total = entries.reduce((sum, entry) => sum + entry.size, 0);
	let evicted: string[] = [];
	let oldest = [...entries].sort((first, second) => first.used - second.used);
	for (let entry of oldest) {
		if (total <= budget) break;
		if (entry.url === keep) continue;
		evicted.push(entry.url);
		total -= entry.size;
	}
	return evicted;
}

/**
 * The entries a new list of declared URLs leaves behind: files the novel no longer declares,
 * such as an old build's hashed URLs. Scene module chunks are kept, since the page never lists
 * them.
 *
 * @param entries - Every cached file.
 * @param declared - The URLs the page just declared.
 * @param modules - Reports whether a URL is a scene module chunk.
 * @returns The URLs to delete.
 */
export function undeclared(
	entries: readonly CachedEntry[],
	declared: ReadonlySet<string>,
	modules: (url: URL) => boolean,
): string[] {
	return entries
		.filter((entry) => !declared.has(entry.url) && !modules(new URL(entry.url)))
		.map((entry) => entry.url);
}
