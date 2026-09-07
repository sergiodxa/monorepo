/**
 * A cache over a Cloudflare KV namespace, which is where entries go in
 * production. Given a `waitUntil` it hands the put to it and answers from a
 * buffer meanwhile, so a miss never waits on KV and a write is readable regardless.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { JSONSerialized, JSONValue } from "@sdxc/types";

import { isFailure, isSuccess, success } from "@sdxc/result";

import type { Cache, CacheError, CacheWriteOptions } from "../index.js";

import { attempt, attemptLoad } from "../lib/attempt.js";
import { parse, serialize } from "../lib/json.js";
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
 * and reports `unavailable`; a caller wanting a shorter lifetime than that wants
 * something other than a cache.
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

	async read<T = JSONValue>(key: string): Promise<Result<JSONSerialized<T> | null, CacheError>> {
		let text = await this.#load(key);
		if (isFailure(text)) return text;
		if (text.data === null) return success(null);
		return parse<T>(key, text.data);
	}

	async write<T>(
		key: string,
		value: T,
		options: CacheWriteOptions = {},
	): Promise<Result<void, CacheError>> {
		let text = serialize(key, value);
		if (isFailure(text)) return text;
		return this.#store(key, text.data, options);
	}

	async fetch<T>(
		key: string,
		load: () => Promise<T>,
		options: CacheWriteOptions = {},
	): Promise<Result<JSONSerialized<T>, CacheError>> {
		let stored = await this.#load(key);
		if (isSuccess(stored) && stored.data !== null) {
			let hit = parse<T>(key, stored.data);
			if (isSuccess(hit)) return hit;
		}

		let loaded = await attemptLoad(key, load);
		if (isFailure(loaded)) return loaded;

		let text = serialize(key, loaded.data);
		if (isFailure(text)) return text;

		await this.#store(key, text.data, options);
		return parse<T>(key, text.data);
	}

	async delete(key: string): Promise<Result<void, CacheError>> {
		let inflight = this.#pending.get(key);
		this.#pending.delete(key);
		if (inflight !== undefined) await inflight.settled;

		return attempt("delete", key, () => this.#kv.delete(key));
	}

	/** The stored text, from the buffer when a put is still in flight. */
	async #load(key: string): Promise<Result<string | null, CacheError>> {
		let buffered = this.#pending.get(key);
		if (buffered !== undefined) return success(buffered.text);
		return attempt("read", key, () => this.#kv.get(key, "text"));
	}

	/**
	 * Stores the text, returning once it is readable: immediately when the put is
	 * deferred, since the buffer answers for it until KV does. A deferred put is
	 * chained after any put already in flight for the key, so two writes land in order.
	 */
	async #store(
		key: string,
		text: string,
		{ ttl }: CacheWriteOptions,
	): Promise<Result<void, CacheError>> {
		let put = (): Promise<void> => this.#kv.put(key, text, { expirationTtl: ttlSeconds(ttl) });

		if (this.#waitUntil === undefined) return attempt("write", key, put);

		let previous = this.#pending.get(key)?.settled;
		let settled = (previous ?? Promise.resolve()).then(async () => {
			await attempt("write", key, put);
		});

		this.#pending.set(key, { text, settled });
		this.#waitUntil(
			settled.finally(() => {
				if (this.#pending.get(key)?.settled === settled) this.#pending.delete(key);
			}),
		);

		return success(undefined);
	}
}
