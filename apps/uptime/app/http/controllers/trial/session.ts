/**
 * The two values the public try-it pages hand between requests, and the keys they travel
 * under.
 *
 * Almost nothing on this feature needs a session any more: `/try` runs its check on the
 * `POST` and renders the answer in that same response, so the result a visitor is looking
 * at was produced by the request that drew it. What is left here is the pair that genuinely
 * spans two requests, and each is here for its own reason rather than as a way to move
 * markup around.
 *
 * **Plain session values, never `session.flash`.** Show-once is exactly what a flash is
 * for, and it is exactly what breaks here: a delivered flash marks the session dirty the
 * moment it is read, the session middleware saves after the handler returns, and for a
 * streamed document that save can land before every frame has resolved — so the value is
 * cleared before the markup that needed it was produced. The dashboard's quick check was
 * bitten by this; see `QUICK_PING_RESULT` in `~/app/http/controllers/actions/ping` for the
 * long version. A plain value leaves the reading request clean, and whoever consumes it
 * removes it by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Session } from "remix/session";

import type { MonitorStatus } from "~/database/schema";

/**
 * A probe that ran, in the shape both the result card and the watch it can become need.
 *
 * This is the record of what *we* observed, which is why the email form has no hidden
 * fields: the URL a watch gets created for is the one that went through
 * `guardTrialProbe`, not the one that came back up from the browser.
 */
export interface TrialProbeState {
	/** The normalized absolute URL, as the guard resolved it. */
	url: string;
	status: MonitorStatus;
	/** `null` when the target never answered, which is not the same as a 0. */
	responseStatus: number | null;
	responseTimeMs: number | null;
	/**
	 * Where a `3xx` pointed, absolute, or `null` when the answer was not a redirect or the
	 * destination could not be read.
	 *
	 * A trial probe does not follow redirects — that refusal is what keeps `trial-guard.ts`'s
	 * verdict on the target's addresses from being walked past — so the destination is
	 * something the page reports rather than something it visited. It is carried separately
	 * from {@link status} because a `301` classifies as `down` against the expected `200`,
	 * and telling somebody whose site simply redirects to HTTPS that it is down would be
	 * both unhelpful and false.
	 */
	location: string | null;
	/** When the probe ran, so the page and the email report the same instant. */
	checkedAt: number;
}

/** Lowest status code that is a redirect. */
const REDIRECT_MIN = 300;

/** First status code past the redirect range. */
const REDIRECT_MAX = 400;

/**
 * Whether a probe came back as a redirect this page must describe rather than classify.
 *
 * @param probe - The check that ran.
 * @returns Whether the target answered with a `3xx`.
 */
export function isRedirectProbe(probe: TrialProbeState): boolean {
	if (probe.responseStatus === null) return false;
	return probe.responseStatus >= REDIRECT_MIN && probe.responseStatus < REDIRECT_MAX;
}

/**
 * Session key for {@link TrialProbeState}.
 *
 * The probe is stored even though the page that shows it no longer reads it back, because
 * the email form under the result is a second request and the watch it opens must be for
 * a URL we ourselves resolved and checked. Carrying the URL and its status in hidden
 * fields instead would let anyone schedule a week of hourly fetches at any target without
 * ever running a probe. Written by `POST /try`, removed by the `POST /try/lead` that
 * claims it — which is also what makes a double submit idempotent.
 */
export const TRIAL_PROBE = "trialProbe";

/**
 * Session key for the URL a just-created watch covers, rendered once as a receipt.
 *
 * The one place a redirect is still the right answer: `POST /try/lead` has written rows
 * and queued mail, so it must not be repeatable by a reload. The receipt is what survives
 * that redirect, and `GET /try` removes it as it renders it.
 */
export const TRIAL_WATCH_STARTED = "trialWatchStarted";

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
