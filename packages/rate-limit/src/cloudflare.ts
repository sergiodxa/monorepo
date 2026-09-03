/**
 * Adapter over a Cloudflare rate limiter binding. The binding answers only
 * `{ success }`, so the limit and window are declared here to mirror
 * `wrangler.jsonc`, which is what lets the adapter report a limit and a reset.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Adapter, RateLimitDecision } from "./types";

import { normalizeCost } from "./cost";
import { RateLimitError } from "./rate-limit-error";
import { fixedWindow, windowDecision } from "./window";

/**
 * The part of a Cloudflare rate limiter binding this adapter uses. Declared
 * structurally instead of read from an ambient global, so the adapter is testable
 * with a double and a package importing it needs no platform type dependency.
 */
export interface RateLimiterBinding {
	/**
	 * Counts one request against the key and reports whether it fit.
	 *
	 * @param options - The key to count against.
	 * @returns Whether the request was inside the configured limit.
	 */
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * How a {@link CloudflareAdapter} is configured. Both fields are declared
 * metadata kept in step with `wrangler.jsonc`'s `simple: { limit, period }`
 * block; drift leaves limiting correct but the response headers wrong.
 */
export interface CloudflareAdapterOptions {
	/** The binding's declared `limit`. */
	limit: number;
	/** The binding's declared `period`, e.g. `"10 seconds"` for `period: 10`. */
	window: DurationInput;
}

/**
 * Limits through a Cloudflare rate limiter binding — the cheapest backend and
 * the default choice on Workers. It reports no quota state, so `remaining`
 * stays `null`, and `reset` is derived from the declared window, epoch-aligned.
 */
export class CloudflareAdapter implements Adapter {
	/** Requests permitted per window, as declared for the binding. */
	readonly limit: number;

	/** Length of the counting window, as declared for the binding. */
	readonly window: DurationInput;

	#binding: RateLimiterBinding;

	/**
	 * Wraps a binding with the policy metadata it cannot report itself.
	 *
	 * @param binding - The rate limiter binding, e.g. `env.AUTH_RATE_LIMITER`.
	 * @param options - The binding's declared limit and period.
	 */
	constructor(binding: RateLimiterBinding, options: CloudflareAdapterOptions) {
		this.#binding = binding;
		this.limit = options.limit;
		this.window = options.window;
	}

	/**
	 * Counts an attempt against the binding. It counts exactly one request per
	 * call, so a cost above 1 issues that many calls and stops at the first
	 * refusal — keep costs small here, or pick a backend that stores counts itself.
	 *
	 * @param key - Namespaced identifier being limited.
	 * @param cost - Units to spend, at least 1; defaults to 1.
	 * @returns The decision, or a `RateLimitError` when the binding rejects.
	 */
	async consume(key: string, cost?: number): Promise<Result<RateLimitDecision, RateLimitError>> {
		let spend = normalizeCost(cost);
		let allowed = true;

		for (let attempt = 0; attempt < spend; attempt += 1) {
			try {
				let outcome = await this.#binding.limit({ key });
				if (!outcome.success) {
					allowed = false;
					break;
				}
			} catch (error) {
				return failure(
					new RateLimitError("The Cloudflare rate limiter binding failed to answer", {
						backend: "cloudflare",
						key,
						cause: error,
					}),
				);
			}
		}

		let now = Date.now();
		return success(
			windowDecision({
				allowed,
				limit: this.limit,
				remaining: null,
				window: fixedWindow(this.window, now),
				now,
			}),
		);
	}

	/**
	 * Always fails: the binding exposes no way to clear a key's counter.
	 *
	 * Reporting a failure keeps the contract honest — a caller that needs to lift a
	 * limit early must use a backend that stores the counts itself.
	 *
	 * @param key - Namespaced identifier that cannot be cleared.
	 * @returns A `RateLimitError` explaining that the backend has no reset.
	 */
	async reset(key: string): Promise<Result<void, RateLimitError>> {
		return failure(
			new RateLimitError("The Cloudflare rate limiter binding cannot reset a key", {
				backend: "cloudflare",
				key,
			}),
		);
	}
}
