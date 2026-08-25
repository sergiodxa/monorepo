/**
 * The values the public try-it pages pass between requests, and the keys they travel under.
 * Held as plain session values: flashing one would mark the session dirty the moment it is
 * read, and the session middleware's save after the handler returns could then land before a
 * streamed response finishes every frame, clearing the value before it was ever shown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Session } from "remix/session";

import type { MonitorStatus } from "~/database/schema";

/**
 * A probe that ran, in the shape both the result card and the watch it can
 * become need. The watch created from it targets the URL `guardTrialProbe`
 * itself resolved and verified, carried forward through session state.
 */
export interface TrialProbeState {
	/** The normalized absolute URL, as the guard resolved it. */
	url: string;
	status: MonitorStatus;
	/** `null` when the target never answered, distinct from an explicit `0` status. */
	responseStatus: number | null;
	responseTimeMs: number | null;
	/**
	 * Where a `3xx` pointed, as an absolute URL, or `null` otherwise. Kept apart
	 * from {@link status} because a `301` reads as `down` against the expected
	 * `200`, and a site that simply redirects to HTTPS deserves a better verdict.
	 */
	location: string | null;
	/** When the probe ran, so the page and the email report the same instant. */
	checkedAt: number;
}

const REDIRECT_MIN = 300;

const REDIRECT_MAX = 400;

/**
 * Whether a probe answered with a redirect, an outcome the page reports on
 * its own terms.
 *
 * @param probe - The check that ran.
 * @returns Whether the target answered with a `3xx`.
 */
export function isRedirectProbe(probe: TrialProbeState): boolean {
	if (probe.responseStatus === null) return false;
	return probe.responseStatus >= REDIRECT_MIN && probe.responseStatus < REDIRECT_MAX;
}

/**
 * Session key for {@link TrialProbeState}, kept across the second request so
 * `POST /try/lead` opens a watch only for a URL this app itself resolved and
 * checked. Removed once claimed, so a double submit stays idempotent.
 */
export const TRIAL_PROBE = "trialProbe";

/**
 * Session key for the URL a just-created watch covers, rendered once as a
 * receipt. `POST /try/lead` redirects after writing rows and queuing mail, so
 * a reload lands safely; `GET /try` reads and clears this key as it renders.
 */
export const TRIAL_WATCH_STARTED = "trialWatchStarted";

/**
 * Session key for the URL a submission was capped on, rendered once as its
 * own receipt distinct from {@link TRIAL_WATCH_STARTED}, keeping the message
 * honest when a target already had its free week within the last thirty days.
 */
export const TRIAL_WATCH_REPEATED = "trialWatchRepeated";

/**
 * Reads a trial value and removes it, for the handler that consumes it.
 *
 * @param session - The request's session, absent when no session middleware ran.
 * @param key - One of the two keys above.
 * @returns The stored value, or `undefined`.
 */
export function takeTrialState<Value>(
	session: Session | undefined,
	key: string,
): Value | undefined {
	let value = session?.get(key) as Value | undefined;
	if (value !== undefined) session?.unset(key);
	return value;
}
