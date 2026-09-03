/**
 * The vocabulary every backend answers in: the decision one consume call
 * produces, and the adapter contract the middleware and direct callers program
 * against. Nothing here knows about HTTP, so jobs and queues use it unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import type { RateLimitError } from "./rate-limit-error.js";

/**
 * What a backend answers for one attempt against one key. Every field except
 * `remaining` is always populated, so a caller can report a limit and a reset
 * time without knowing which storage produced them.
 */
export interface RateLimitDecision {
	/** Whether the attempt fits inside the current window. */
	allowed: boolean;
	/** Requests permitted per window, from adapter configuration. */
	limit: number;
	/** Requests left in the current window; `null` when the backend cannot report it. */
	remaining: number | null;
	/** When the current window resets. */
	reset: Date;
	/** Seconds until the window resets; used for `Retry-After`. */
	retryAfter: number;
}

/**
 * A rate limit backend where implementations own counting and the policy is
 * stated once on the adapter for every call site to read. `consume` reports
 * failure through a `Result`, since an unreachable backend is expected.
 */
export interface Adapter {
	/** Requests permitted per window, as configured. */
	readonly limit: number;
	/** Length of the counting window. */
	readonly window: DurationInput;
	/**
	 * Spends `cost` units of the key's budget and reports the resulting decision.
	 *
	 * A denied attempt does not spend budget, so a client that keeps hammering a
	 * limited key cannot push its own reset time further away.
	 *
	 * @param key - Namespaced identifier being limited, never raw user input alone.
	 * @param cost - Units to spend, at least 1; defaults to 1.
	 * @returns The decision, or a `RateLimitError` when the backend cannot answer.
	 */
	consume(key: string, cost?: number): Promise<Result<RateLimitDecision, RateLimitError>>;
	/**
	 * Clears the key's current counter, so the next attempt starts a fresh budget.
	 *
	 * @param key - Namespaced identifier to clear.
	 * @returns Success, or a `RateLimitError` when the backend cannot clear it.
	 */
	reset(key: string): Promise<Result<void, RateLimitError>>;
}
