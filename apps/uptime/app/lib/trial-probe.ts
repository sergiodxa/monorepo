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
 * How long a trial probe waits, in seconds: the monitors table's own
 * default, so a visitor sees the same reading a real monitor would
 * produce for that target.
 */
const TIMEOUT_SECONDS = 10;

/** Response time above which a correct response is `degraded`, matching a real monitor. */
const DEGRADED_AFTER_MS = 5000;

/**
 * Where a trial probe runs from, held fixed. The page asks one question,
 * and any region answers it about as well as another.
 */
const LOCATION_HINT: DurableObjectLocationHint = "wnam";

/**
 * Builds the check options for one trial probe of `url`. `followRedirects:
 * false` keeps a redirect from bypassing the hostname guard's decision by
 * having `fetch` follow it after the guard has already cleared the target.
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
