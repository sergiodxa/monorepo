/**
 * A cache whose store is a map, for tests and for anything wanting a cache
 * without a platform behind it. It serializes what it holds and expires against
 * an injectable clock, so it answers exactly as a remote store would.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONSerialized, JSONValue } from "@sdxc/types";

import type { Cache, CacheWriteOptions } from "../index.js";

import { ttlSeconds } from "../lib/ttl.js";

/** Milliseconds in the second a TTL is counted in. */
const SECOND_MS = 1000;

/** What the map holds: the written text, and when it stops being readable. */
interface Entry {
	text: string;
	expiresAt: number | undefined;
}

/** How a memory cache tells the time. */
export interface MemoryCacheOptions {
	/**
	 * Reads the current time in milliseconds. A test supplies its own so an entry
	 * can be expired without waiting for one.
	 *
	 * @default Date.now
	 */
	now?: () => number;
}

/**
 * Holds entries in a map for the life of the instance.
 *
 * It is not a mock: it serializes on write and parses on read, so a `Date` comes
 * back as a string here exactly as it would from a remote store, and it passes
 * the same conformance suite every other adapter does.
 */
export class MemoryCache implements Cache {
	readonly #entries = new Map<string, Entry>();
	readonly #now: () => number;

	/**
	 * @param options How the cache tells the time.
	 */
	constructor({ now = Date.now }: MemoryCacheOptions = {}) {
		this.#now = now;
	}

	async read<T = JSONValue>(key: string): Promise<JSONSerialized<T> | null> {
		let text = this.#read(key);
		if (text === null) return null;
		return JSON.parse(text) as JSONSerialized<T>;
	}

	async write<T>(key: string, value: T, options: CacheWriteOptions = {}): Promise<void> {
		this.#write(key, JSON.stringify(value), options);
	}

	async fetch<T>(
		key: string,
		load: () => Promise<T>,
		options: CacheWriteOptions = {},
	): Promise<JSONSerialized<T>> {
		let hit = this.#read(key);
		if (hit !== null) return JSON.parse(hit) as JSONSerialized<T>;

		let text = JSON.stringify(await load());
		this.#write(key, text, options);
		return JSON.parse(text) as JSONSerialized<T>;
	}

	async delete(key: string): Promise<void> {
		this.#entries.delete(key);
	}

	/**
	 * The stored text, or `null` when nothing readable is held. An expired entry is
	 * dropped as it is found, which is the only sweep the map gets.
	 */
	#read(key: string): string | null {
		let entry = this.#entries.get(key);
		if (entry === undefined) return null;
		if (entry.expiresAt !== undefined && this.#now() >= entry.expiresAt) {
			this.#entries.delete(key);
			return null;
		}
		return entry.text;
	}

	/** Stores the text against the expiry the TTL resolves to. */
	#write(key: string, text: string, { ttl }: CacheWriteOptions): void {
		let seconds = ttlSeconds(ttl);
		this.#entries.set(key, {
			text,
			expiresAt: seconds === undefined ? undefined : this.#now() + seconds * SECOND_MS,
		});
	}
}
