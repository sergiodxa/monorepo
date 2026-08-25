/**
 * Window arithmetic shared by the counting adapters: the length of a configured
 * window, the aligned bucket a timestamp falls into, and the decision built from
 * a count. Keeping it here means every backend reports `reset` the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";

import { toMs } from "@pkg/duration";

import type { RateLimitDecision } from "./types";

/** Milliseconds in one second, the unit `Retry-After` and `reset` count in. */
const SECOND_MS = 1000;

/** One aligned counting bucket: when it opened, when it closes, and how long it is. */
export interface FixedWindow {
	/** Epoch milliseconds when the window opened. */
	start: number;
	/** Epoch milliseconds when the window closes and the counter resets. */
	end: number;
	/** Window length in milliseconds. */
	length: number;
}

/** Everything needed to describe a decision over an aligned window. */
export interface WindowDecisionInput {
	/** Whether the attempt fits inside the window. */
	allowed: boolean;
	/** Requests permitted per window. */
	limit: number;
	/** Requests left, or `null` when the backend cannot report it. */
	remaining: number | null;
	/** The window the decision was made in. */
	window: FixedWindow;
	/** Epoch milliseconds the decision was made at. */
	now: number;
}

/**
 * Window length in milliseconds, normalized to a whole positive number. A
 * zero, negative, or `NaN` duration collapses to a 1 ms window that resets
 * immediately, so a misconfigured window fails open instead of locking clients.
 *
 * @param window - The configured window length.
 * @returns Whole milliseconds, never below 1.
 *
 * @example
 * windowLengthMs("10 seconds"); // 10000
 * @example
 * windowLengthMs(0); // 1
 */
export function windowLengthMs(window: DurationInput): number {
	let ms = toMs(window);
	if (!Number.isFinite(ms)) return 1;
	return Math.max(1, Math.trunc(ms));
}

/**
 * The aligned window a timestamp falls into. Alignment is to the epoch, so every
 * isolate and every storage backend agree on the bucket boundaries for a given
 * window length without coordinating.
 *
 * @param window - The configured window length.
 * @param now - Epoch milliseconds to locate.
 * @returns The bucket containing `now`.
 *
 * @example
 * fixedWindow("1 minute", 90_000); // { start: 60000, end: 120000, length: 60000 }
 */
export function fixedWindow(window: DurationInput, now: number): FixedWindow {
	let length = windowLengthMs(window);
	let start = Math.floor(now / length) * length;
	return { start, end: start + length, length };
}

/**
 * Whole seconds from `now` until `target`, rounded up so a client that waits the
 * reported time is past the reset rather than one millisecond short of it.
 *
 * @param now - Epoch milliseconds the decision was made at.
 * @param target - Epoch milliseconds the window closes at.
 * @returns Seconds to wait, never negative.
 *
 * @example
 * retryAfterSeconds(1000, 7400); // 7
 */
export function retryAfterSeconds(now: number, target: number): number {
	let delta = target - now;
	if (!Number.isFinite(delta) || delta <= 0) return 0;
	return Math.ceil(delta / SECOND_MS);
}

/**
 * Builds the decision for an aligned window, deriving `reset` from the window's
 * close time and `retryAfter` from the distance to it, so the two can never
 * disagree.
 *
 * @param input - Outcome, policy, and the window it was decided in.
 * @returns The decision to hand back to the caller.
 */
export function windowDecision(input: WindowDecisionInput): RateLimitDecision {
	return {
		allowed: input.allowed,
		limit: input.limit,
		remaining: input.remaining,
		reset: new Date(input.window.end),
		retryAfter: retryAfterSeconds(input.now, input.window.end),
	};
}
