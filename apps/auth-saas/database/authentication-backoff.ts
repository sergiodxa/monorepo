/**
 * The consecutive-failure backoff shared by every credential surface that
 * carries a `failed_attempts`/`retry_after`/`last_failure_at` triple on its
 * own row: a password's newest row and a subject's TOTP factor both grow the
 * same counter, earn the same doubling delay once it crosses the tenant's
 * threshold, and decay the same way after a day of quiet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** How many consecutive failures a tenant tolerates before backoff begins, when it has never configured its own threshold. */
export const DEFAULT_FAILURE_THRESHOLD = 4;

/** The delay a failure count earns the moment it reaches the threshold, doubling with every failure past it. */
const BACKOFF_BASE_MS = 1000;

/** How far a backoff delay ever climbs, however many failures past the threshold a counter reaches. */
const BACKOFF_CEILING_MS = 15 * 60 * 1000;

/** How long a failure counter sits untouched before the next failure starts it over rather than continuing it. */
const BACKOFF_DECAY_MS = 24 * 60 * 60 * 1000;

/** The exponential delay a failure count past the threshold earns: one second at the threshold itself, doubling with each failure beyond it, capped at the ceiling. */
export function backoffDelayMs(failedAttempts: number, threshold: number): number {
	let stepsPastThreshold = failedAttempts - threshold;
	return Math.min(BACKOFF_BASE_MS * 2 ** stepsPastThreshold, BACKOFF_CEILING_MS);
}

/** The three columns a credential row carries for this backoff, wherever it lives. */
export interface BackoffState {
	failed_attempts: number;
	retry_after: number | null;
	last_failure_at: number | null;
}

/**
 * What a wrong attempt writes onto a credential row: the counter climbed by
 * one, or restarted at one when the previous failure is more than a day old,
 * and the backoff that count now earns once it reaches the tenant's own
 * threshold.
 */
export function nextFailureState(
	current: BackoffState,
	threshold: number,
	now: number,
): BackoffState {
	let decayed =
		current.last_failure_at === null || now - current.last_failure_at > BACKOFF_DECAY_MS;
	let failedAttempts = decayed ? 1 : current.failed_attempts + 1;

	return {
		failed_attempts: failedAttempts,
		retry_after:
			failedAttempts >= threshold ? now + backoffDelayMs(failedAttempts, threshold) : null,
		last_failure_at: now,
	};
}

/** The three columns a genuine success writes, clearing whatever a credential row had accumulated. */
export function clearedBackoff(): BackoffState {
	return { failed_attempts: 0, retry_after: null, last_failure_at: null };
}
