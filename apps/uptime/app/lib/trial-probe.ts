/**
 * The one description of how the public trial probes a URL, shared by the visitor's first
 * check on `/try` and by the hourly sweep that re-checks it for a week.
 *
 * They have to agree. The result a stranger sees on the page and the results the digests
 * report a week later are presented as the same measurement, and they stop being one the
 * moment the two callers drift on a timeout or an expected status. Both were spelled out
 * separately before this existed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HttpCheckOptions } from "~/app/services/http-check";

/**
 * How long a trial probe waits, in seconds. The monitors table's own default: a visitor
 * judging the product should see what a real monitor would have measured, not a stricter
 * or more forgiving reading of the same target.
 */
const TIMEOUT_SECONDS = 10;

/** Response time above which a correct response is `degraded`, matching a real monitor. */
const DEGRADED_AFTER_MS = 5000;

/**
 * Where a trial probe runs from. Fixed rather than offered: the page asks one question and
 * a region picker is a second one, and every region costs the same to answer wrongly.
 */
const LOCATION_HINT: DurableObjectLocationHint = "wnam";

/**
 * Builds the check options for one trial probe of `url`.
 *
 * `followRedirects: false` is the load-bearing part and is not a default anyone should
 * override here. `app/services/trial-guard.ts` decides whether a target is safe by
 * resolving its hostname and checking the addresses it points at — and a target answering
 * `302 http://169.254.169.254/` reaches cloud metadata anyway if the hop is followed,
 * because `fetch` follows it long after the guard has finished. Refusing to follow is what
 * makes the guard's decision the one that holds. A redirect therefore comes back as the
 * 3xx it is, which classifies as `down` against the expected 200 — correct, and honest
 * about the fact that we did not go there.
 *
 * `method: "GET"` rather than the monitors' `HEAD`, for the same reason the dashboard's
 * quick check uses GET: a URL a person typed is usually a page or a healthcheck endpoint,
 * and some answer `HEAD` with a 405 that says nothing about whether the service is up.
 *
 * @param url The target the visitor asked about.
 * @returns Options to construct an `HttpCheck` with.
 */
export function trialProbeOptions(url: string): HttpCheckOptions {
	return {
		url,
		method: "GET",
		expectedStatus: 200,
		degradedAfterMs: DEGRADED_AFTER_MS,
		timeoutSeconds: TIMEOUT_SECONDS,
		locationHint: LOCATION_HINT,
		/** Keeps a repeated check of the same target on one warm Durable Object. */
		shardKey: url,
		contentChecks: [],
		followRedirects: false,
	};
}
