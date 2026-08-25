/**
 * Fixed-window counters in Workers KV, one entry per key and window, expiring on
 * their own through a KV TTL. It is the middle option: cheaper than a per-request
 * write to SQL, and available without provisioning a limiter namespace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";
import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";

import type { Adapter, RateLimitDecision } from "./types";

import { normalizeCost } from "./cost";
import { RateLimitError } from "./rate-limit-error";
import { fixedWindow, windowDecision, windowLengthMs } from "./window";

/** Milliseconds in one second, for converting a window to a KV TTL. */
const SECOND_MS = 1000;

/**
 * Shortest TTL Workers KV accepts. A shorter window still writes with this TTL:
 * the entry key contains the window start, so an entry that outlives its window is
 * simply never read again.
 */
const MINIMUM_EXPIRATION_TTL_SECONDS = 60;

/** Namespace prefix used when a call site does not choose one. */
const DEFAULT_PREFIX = "rate-limit";

/**
 * The part of a KV namespace this adapter uses. Declared structurally so the
 * adapter is testable with a `Map`-backed double, and satisfied by a real
 * `KVNamespace` binding.
 */
export interface RateLimitKVNamespace {
	/**
	 * Reads an entry as text.
	 *
	 * @param key - Full KV entry key.
	 * @returns The stored text, or `null` when the entry is absent or expired.
	 */
	get(key: string): Promise<string | null>;
	/**
	 * Writes an entry, optionally with a TTL in seconds.
	 *
	 * @param key - Full KV entry key.
	 * @param value - Text to store.
	 * @param options - Write options; `expirationTtl` is seconds until removal.
	 */
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
	/**
	 * Removes an entry.
	 *
	 * @param key - Full KV entry key.
	 */
	delete(key: string): Promise<void>;
}

/** How a {@link KVAdapter} is configured. */
export interface KVAdapterOptions {
	/** Requests permitted per window. */
	limit: number;
	/** Length of the counting window, also used as the entry's TTL. */
	window: DurationInput;
	/**
	 * Namespace prefix for entry keys, so unrelated limiters can share one KV
	 * namespace. Defaults to `"rate-limit"`.
	 */
	prefix?: string;
}

/**
 * Counts attempts as KV entries keyed by prefix, key, and window start.
 *
 * Reads, increments, and writes back the counter, so concurrent requests can
 * double-count; choose a counting backend when the limit must be exact.
 */
export class KVAdapter implements Adapter {
	/** Requests permitted per window, as configured. */
	readonly limit: number;

	/** Length of the counting window, as configured. */
	readonly window: DurationInput;

	/** Namespace prefix applied to every entry key. */
	readonly prefix: string;

	/** The KV namespace holding the counters. */
	#kv: RateLimitKVNamespace;

	/**
	 * Wraps a KV namespace as a fixed-window limiter.
	 *
	 * @param kv - The KV namespace binding, e.g. `env.RATE_LIMIT_KV`.
	 * @param options - Limit, window, and optional prefix; see {@link KVAdapterOptions}.
	 */
	constructor(kv: RateLimitKVNamespace, options: KVAdapterOptions) {
		this.#kv = kv;
		this.limit = options.limit;
		this.window = options.window;
		this.prefix = options.prefix ?? DEFAULT_PREFIX;
	}

	/**
	 * Spends budget for a key inside the current aligned window.
	 *
	 * A rollover needs no cleanup since the new window uses a different entry key,
	 * and a denied attempt writes nothing, so retries cost reads only.
	 *
	 * @param key - Namespaced identifier being limited.
	 * @param cost - Units to spend, at least 1; defaults to 1.
	 * @returns The decision, or a `RateLimitError` when KV cannot be read or written.
	 */
	async consume(key: string, cost?: number): Promise<Result<RateLimitDecision, RateLimitError>> {
		let now = Date.now();
		let window = fixedWindow(this.window, now);
		let entryKey = this.#entryKey(key, window.start);
		let spend = normalizeCost(cost);

		let used: number;
		try {
			used = parseCount(await this.#kv.get(entryKey));
		} catch (error) {
			return failure(
				new RateLimitError("The KV namespace failed to read a rate limit counter", {
					backend: "kv",
					key,
					cause: error,
				}),
			);
		}

		let requested = used + spend;
		let allowed = requested <= this.limit;

		if (allowed) {
			try {
				await this.#kv.put(entryKey, String(requested), {
					expirationTtl: expirationTtlSeconds(this.window),
				});
			} catch (error) {
				return failure(
					new RateLimitError("The KV namespace failed to write a rate limit counter", {
						backend: "kv",
						key,
						cause: error,
					}),
				);
			}
			used = requested;
		}

		return success(
			windowDecision({
				allowed,
				limit: this.limit,
				remaining: Math.max(0, this.limit - used),
				window,
				now,
			}),
		);
	}

	/**
	 * Removes the key's entry for the window in progress. Entries from earlier
	 * windows are left to expire, since nothing reads them again.
	 *
	 * @param key - Namespaced identifier to clear.
	 * @returns Success, or a `RateLimitError` when the delete fails.
	 */
	async reset(key: string): Promise<Result<void, RateLimitError>> {
		let window = fixedWindow(this.window, Date.now());
		try {
			await this.#kv.delete(this.#entryKey(key, window.start));
			return success(undefined);
		} catch (error) {
			return failure(
				new RateLimitError("The KV namespace failed to delete a rate limit counter", {
					backend: "kv",
					key,
					cause: error,
				}),
			);
		}
	}

	/**
	 * The entry key for a key in a window: `prefix:key:window-start`.
	 *
	 * @param key - Namespaced identifier being limited.
	 * @param windowStart - Epoch milliseconds the window opened at.
	 * @returns The full KV entry key.
	 */
	#entryKey(key: string, windowStart: number): string {
		return `${this.prefix}:${key}:${windowStart}`;
	}
}

/**
 * Reads a stored counter, treating a missing or corrupt entry as zero so a bad
 * value costs a client one window of budget instead of locking the key.
 *
 * @param raw - The stored text, or `null` when absent.
 * @returns The count, never negative.
 */
function parseCount(raw: string | null): number {
	if (raw === null) return 0;
	let count = Number(raw);
	if (!Number.isFinite(count) || count < 0) return 0;
	return Math.trunc(count);
}

/**
 * The TTL to write an entry with: the window length in seconds, raised to KV's
 * own minimum when the window is shorter.
 *
 * @param window - The configured window length.
 * @returns Seconds until KV removes the entry.
 */
function expirationTtlSeconds(window: DurationInput): number {
	let seconds = Math.ceil(windowLengthMs(window) / SECOND_MS);
	return Math.max(MINIMUM_EXPIRATION_TTL_SECONDS, seconds);
}
