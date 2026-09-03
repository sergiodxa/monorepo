/**
 * In-process fixed-window counters. It is the adapter for tests and local
 * development, where a real backend would add setup without changing behavior,
 * and the reference implementation of the counting the other adapters persist.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { success } from "@sdxc/result";

import type { RateLimitError } from "./rate-limit-error";
import type { Adapter, RateLimitDecision } from "./types";

import { normalizeCost } from "./cost";
import { fixedWindow, windowDecision } from "./window";

/** How a {@link MemoryAdapter} is configured. */
export interface MemoryAdapterOptions {
	/** Requests permitted per window. */
	limit: number;
	/** Length of the counting window. */
	window: DurationInput;
}

/** One key's counter, valid only for the window it was opened in. */
interface MemoryCounter {
	/** Epoch milliseconds of the window this count belongs to. */
	windowStart: number;
	/** Budget units spent so far in that window. */
	used: number;
}

/**
 * Counts attempts in a `Map` held by the adapter instance. Counters live and
 * die with the instance, shared by no other process or isolate, which makes
 * this unsuitable for production but exactly right for deterministic tests.
 */
export class MemoryAdapter implements Adapter {
	/** Requests permitted per window, as configured. */
	readonly limit: number;

	/** Length of the counting window, as configured. */
	readonly window: DurationInput;

	/** Live counters by key, pruned lazily as each key's window rolls over. */
	#counters = new Map<string, MemoryCounter>();

	/**
	 * Builds an adapter with an empty counter table.
	 *
	 * @param options - Limit and window; see {@link MemoryAdapterOptions}.
	 */
	constructor(options: MemoryAdapterOptions) {
		this.limit = options.limit;
		this.window = options.window;
	}

	/**
	 * Spends budget for a key inside the current aligned window. A stale counter
	 * from an earlier window resets to a full budget rather than decaying, and a
	 * denied attempt is not counted, keeping `remaining` truthful for what landed.
	 *
	 * @param key - Namespaced identifier being limited.
	 * @param cost - Units to spend, at least 1; defaults to 1.
	 * @returns The decision; this adapter cannot fail.
	 */
	async consume(key: string, cost?: number): Promise<Result<RateLimitDecision, RateLimitError>> {
		let now = Date.now();
		let window = fixedWindow(this.window, now);
		let spend = normalizeCost(cost);

		let counter = this.#counters.get(key);
		if (counter === undefined || counter.windowStart !== window.start) {
			counter = { windowStart: window.start, used: 0 };
		}

		let requested = counter.used + spend;
		let allowed = requested <= this.limit;
		if (allowed) {
			counter.used = requested;
			this.#counters.set(key, counter);
		}

		return success(
			windowDecision({
				allowed,
				limit: this.limit,
				remaining: Math.max(0, this.limit - counter.used),
				window,
				now,
			}),
		);
	}

	/**
	 * Drops a key's counter so its next attempt starts a fresh budget.
	 *
	 * @param key - Namespaced identifier to clear.
	 * @returns Success; this adapter cannot fail.
	 */
	async reset(key: string): Promise<Result<void, RateLimitError>> {
		this.#counters.delete(key);
		return success(undefined);
	}

	/**
	 * Drops every counter, so one test's traffic cannot leak into the next when a
	 * single adapter instance is shared across cases.
	 */
	clear(): void {
		this.#counters.clear();
	}
}
