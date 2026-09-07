/**
 * A cache over a Cloudflare KV namespace, which is where entries go in
 * production. Given a `waitUntil` it hands the put to it and answers from a
 * buffer meanwhile, so a miss never waits on KV and a write is readable regardless.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONSerializable, JSONSerialized, JSONValue } from "@sdxc/types";

import type { Cache, CacheWriteOptions } from "../index.js";

import { tolerate } from "../lib/tolerate.js";
import { ttlSeconds } from "../lib/ttl.js";

/** A write handed to `waitUntil`, still in flight. */
interface PendingWrite {
	/** What a read on this instance answers with until KV holds it. */
	text: string;
	/** Settles when the put has finished, and never rejects. */
	settled: Promise<void>;
}

/** How a Worker KV cache defers its writes. */
export interface WorkerKVCacheOptions {
	/**
	 * Extends the invocation past the response so a put can finish after it. Given
	 * one, a write is handed over and the caller is not made to wait for KV.
	 */
	waitUntil?: (promise: Promise<unknown>) => void;
}

/**
 * Reads and writes entries in a KV namespace.
 *
 * KV refuses a TTL under 60 seconds, so a shorter one leaves the entry unwritten
 * and warns on the invocation's log; a caller wanting a shorter lifetime than
 * that wants something other than a cache.
 */
export class WorkerKVCache implements Cache {
	readonly #kv: KVNamespace;
	readonly #waitUntil: ((promise: Promise<unknown>) => void) | undefined;

	/**
	 * Values written while their put is still in flight, so a read on this instance
	 * sees what was just written. The instance is per request, which is the scope
	 * over which reading your own writes is both achievable and worth anything.
	 */
	readonly #pending = new Map<string, PendingWrite>();

	/**
	 * @param kv The namespace entries are stored in.
	 * @param options How writes are deferred.
	 */
	constructor(kv: KVNamespace, { waitUntil }: WorkerKVCacheOptions = {}) {
		this.#kv = kv;
		this.#waitUntil = waitUntil;
	}

	async read<T extends JSONSerializable = JSONValue>(
		key: string,
	): Promise<JSONSerialized<T> | null> {
		let text = await this.#load(key);
		if (text === null) return null;
		return JSON.parse(text) as JSONSerialized<T>;
	}

	async write<T extends JSONSerializable>(
		key: string,
		value: T,
		options: CacheWriteOptions = {},
	): Promise<void> {
		await this.#store(key, JSON.stringify(value), options);
	}

	async fetch<T extends JSONSerializable>(
		key: string,
		load: () => Promise<T>,
		options: CacheWriteOptions = {},
	): Promise<JSONSerialized<T>> {
		let hit = await this.#load(key);
		if (hit !== null) return JSON.parse(hit) as JSONSerialized<T>;

		let text = JSON.stringify(await load());
		await this.#store(key, text, options);
		return JSON.parse(text) as JSONSerialized<T>;
	}

	async delete(key: string): Promise<void> {
		let inflight = this.#pending.get(key);
		this.#pending.delete(key);
		if (inflight !== undefined) await inflight.settled;
		await tolerate("cache.delete.failed", key, undefined, () => this.#kv.delete(key));
	}

	/** The stored text, from the buffer when a put is still in flight. */
	async #load(key: string): Promise<string | null> {
		let buffered = this.#pending.get(key);
		if (buffered !== undefined) return buffered.text;
		return tolerate("cache.read.failed", key, null, () => this.#kv.get(key, "text"));
	}

	/**
	 * Stores the text, returning once it is readable: immediately when the put is
	 * deferred, since the buffer answers for it until KV does. A deferred put is
	 * chained after any put already in flight for the key, so two writes land in order.
	 */
	async #store(key: string, text: string, { ttl }: CacheWriteOptions): Promise<void> {
		let put = (): Promise<void> => this.#kv.put(key, text, { expirationTtl: ttlSeconds(ttl) });

		if (this.#waitUntil === undefined) {
			await tolerate("cache.write.failed", key, undefined, put);
			return;
		}

		let previous = this.#pending.get(key)?.settled;
		let settled = (previous ?? Promise.resolve()).then(() =>
			tolerate("cache.write.failed", key, undefined, put),
		);

		this.#pending.set(key, { text, settled });
		this.#waitUntil(
			settled.finally(() => {
				if (this.#pending.get(key)?.settled === settled) this.#pending.delete(key);
			}),
		);
	}
}
