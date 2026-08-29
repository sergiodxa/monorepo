/**
 * KV-backed cache used to memoize expensive values behind a cache key. It reads
 * and writes text entries in a Cloudflare KV namespace, defers writes to
 * `waitUntil` so a cache miss never delays the response, and expires entries
 * with a TTL written as a duration. It exists so call sites cache by key without
 * touching the KV binding or its unit conventions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";

import { toSeconds } from "@pkg/duration";

/**
 * Cache stores and the key/option shapes they accept.
 */
export namespace Cache {
	/**
	 * Anything a cache entry can be keyed by: a literal key, or an object that
	 * carries or computes its own key, so domain objects can key their own cache.
	 */
	type CacheKey = string | { cacheKey: string } | { cacheKey(): string };

	/**
	 * Expiration shared by every store write.
	 */
	interface StoreWriteOptions {
		/**
		 * A bare number is whole seconds — the unit KV's `expirationTtl`
		 * counts, so numeric call sites keep their exact expiry — while a
		 * duration string states its own unit. Omitted means no expiration.
		 */
		ttl?: DurationInput;
	}

	/**
	 * Read/write contract every cache store implements, with key normalization
	 * shared by subclasses.
	 */
	abstract class Store {
		/**
		 * Reads an entry, or `null` when it is missing or expired.
		 */
		abstract read(key: CacheKey): Promise<string | null>;
		/**
		 * Writes an entry, replacing any current value for the key.
		 */
		abstract write(key: CacheKey, value: string, options?: StoreWriteOptions): Promise<void>;
		/**
		 * Removes an entry, whether or not it exists.
		 */
		abstract delete(key: CacheKey): Promise<void>;
		/**
		 * Reports whether an unexpired entry exists for the key.
		 */
		abstract exists(key: CacheKey): Promise<boolean>;
		/**
		 * Returns the cached entry, computing and storing it on a miss.
		 */
		abstract fetch(
			key: CacheKey,
			fn: () => Promise<string>,
			options?: StoreWriteOptions,
		): Promise<string>;

		/**
		 * Resolves a cache key to the string the store is keyed by, accepting a
		 * literal key, a `cacheKey` property, or a `cacheKey()` method.
		 */
		protected getKey(key: CacheKey): string {
			if (typeof key === "string") return key;
			if (typeof key.cacheKey === "string") return key.cacheKey;
			return key.cacheKey();
		}
	}

	/**
	 * Expiration plus the metadata KV can store alongside a value.
	 */
	interface KVStoreWriteOptions extends StoreWriteOptions {
		/**
		 * Metadata stored with the entry and returned by KV's metadata reads.
		 */
		metadata?: KVNamespacePutOptions["metadata"];
	}

	/**
	 * A store that uses Cloudflare's KV store.
	 */
	export class KVStore extends Store {
		/**
		 * Binds the store to a KV namespace and the `waitUntil` used to let writes
		 * finish after the response is sent.
		 */
		constructor(
			private readonly kv: KVNamespace,
			private readonly waitUntil: (promise: Promise<unknown>) => void,
		) {
			super();
		}

		/**
		 * Reads the entry as text, or `null` when KV has no unexpired value.
		 */
		async read(key: CacheKey): Promise<string | null> {
			return this.kv.get(this.getKey(key), "text");
		}

		/**
		 * Stores the value, handing the write to `waitUntil` so it does not block
		 * the caller. The TTL is converted to the whole seconds KV expects.
		 */
		async write(
			key: CacheKey,
			value: string,
			{ ttl, metadata }: KVStoreWriteOptions = {},
		): Promise<void> {
			this.waitUntil(
				this.kv.put(this.getKey(key), value, {
					expirationTtl: toExpirationTtl(ttl),
					metadata,
				}),
			);
		}

		/**
		 * Removes the entry from KV.
		 */
		async delete(key: CacheKey): Promise<void> {
			await this.kv.delete(this.getKey(key));
		}

		/**
		 * Reports whether KV holds an unexpired value for the key.
		 */
		async exists(key: CacheKey): Promise<boolean> {
			let result = await this.read(key);
			return result !== null;
		}

		/**
		 * Returns the cached value when present, otherwise computes it, stores it,
		 * and returns it. The write is deferred, so the value is returned without
		 * waiting for KV.
		 */
		async fetch(
			key: CacheKey,
			fn: () => Promise<string>,
			options?: KVStoreWriteOptions,
		): Promise<string> {
			let cached = await this.read(key);
			if (cached !== null) {
				return cached;
			}
			let value = await fn();
			await this.write(key, value, options);
			return value;
		}

		/**
		 * Lists stored key names, optionally restricted to a prefix.
		 *
		 * @returns Up to `limit` key names; KV caps a single page at 1000.
		 */
		async list(prefix?: string, limit = 1000): Promise<string[]> {
			let list = await this.kv.list({ prefix, limit });
			return list.keys.map((key) => key.name);
		}
	}
}

/**
 * A bare number passes through unchanged so existing numeric call sites keep
 * their exact expiry; a duration string converts so `3600` and `"1 hour"`
 * produce the same result. `undefined` stays `undefined`.
 */
function toExpirationTtl(ttl: DurationInput | undefined): number | undefined {
	if (ttl === undefined) return undefined;
	if (typeof ttl === "number") return ttl;
	return toSeconds(ttl);
}
