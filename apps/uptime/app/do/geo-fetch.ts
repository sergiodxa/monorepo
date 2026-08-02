/**
 * A Cloudflare Durable Object that proxies an outbound `fetch` while measuring how long
 * it takes, exposing the elapsed milliseconds via an `X-Response-Time` response header.
 * Because a DO can be pinned to a geographic location hint, it lets the ping job issue
 * monitor checks from a chosen region and record their response times.
 *
 * It reports two timings, because they answer different questions (ADR-019 §2).
 * `X-Response-Time` covers only the proxied request, which is the product metric — what
 * a monitor's users experience. `X-DO-Wall-Time` covers this whole handler, which is
 * the billing metric: Durable Objects are billed for wall-clock duration, and reading a
 * response body for a content check widens that window without changing the probe's
 * latency at all. The gap between the two numbers is exactly what is invisible today.
 *
 * It never lets the proxied request's failure escape as a thrown error. A monitored
 * endpoint that refuses the connection, fails DNS, or drops the request is a valid
 * monitoring result, whereas a rejected call to this object means the object itself is
 * unavailable — the caller has to tell those apart to decide between recording a `down`
 * result and retrying. So an unreachable endpoint comes back as a normal response tagged
 * `X-Probe-Outcome: unreachable`, and only a genuine Durable Object fault rejects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DurableObject } from "cloudflare:workers";

/** Response header naming what happened to the proxied request. */
export const PROBE_OUTCOME_HEADER = "X-Probe-Outcome";

/**
 * Request header asking this object not to follow redirects, stripped before the proxied
 * request goes out so the monitored target never sees it.
 *
 * It exists for the public trial. Every other caller probes a target its own team
 * configured, so following a redirect goes somewhere that team chose. A stranger's URL is
 * different: `app/services/trial-guard.ts` validates the address a hostname resolves to
 * before any probe runs, and a target answering `302 http://169.254.169.254/` walks
 * straight past that check to cloud metadata if the hop is followed, long after the guard
 * has finished deciding.
 *
 * This header is the belt, not the braces. A request arriving at a `fetch` handler already
 * carries redirect mode `manual`, so this object was never the one following — the caller
 * was, in `HttpCheck.probe`'s `stub.fetch`, which is where the mode is actually set and
 * where the fix has to live. Redirect mode is client-side and no HTTP boundary carries it,
 * so this header exists only to make the object's own outbound call explicit rather than
 * incidental, and to fail safe if a future caller reaches it another way.
 */
export const NO_REDIRECT_HEADER = "X-No-Redirect";

/**
 * Response header carrying how long this object's handler ran, in milliseconds.
 *
 * A LOWER BOUND on the billed window, never the billed figure. `performance.now()`
 * inside the object measures the object's own view of the handler: it starts after the
 * request has already been dispatched to the object, and stops before the response body
 * finishes streaming and before the object becomes hibernation-eligible. Cloudflare
 * bills the wider window. Treat this as "at least this long", and reconcile it against
 * `durableObjectsInvocationsAdaptiveGroups`' `sum.wallTime` divided by requests, which
 * is the authoritative aggregate. Presenting an under-measured duration as exact would
 * be worse than not measuring it.
 */
export const DO_WALL_TIME_HEADER = "X-DO-Wall-Time";

export class GeoFetchDO extends DurableObject<Cloudflare.Env> {
	override async fetch(request: Request): Promise<Response> {
		/** Opens the billed window; `start` below opens the narrower probe window. */
		let handlerStart = performance.now();

		/**
		 * Read and removed here rather than forwarded: it is an instruction to this object,
		 * and a monitored endpoint has no business seeing which of our callers asked for it.
		 */
		let followRedirects = request.headers.get(NO_REDIRECT_HEADER) === null;
		if (!followRedirects) {
			request = new Request(request);
			request.headers.delete(NO_REDIRECT_HEADER);
		}

		try {
			let start = performance.now();
			/**
			 * `manual` rather than `error`, so a redirect comes back as the 3xx it is and the
			 * caller can classify it. Throwing would be indistinguishable from the target being
			 * unreachable, which is a different fact.
			 */
			let response = await fetch(request, { redirect: followRedirects ? "follow" : "manual" });
			let end = performance.now();

			response = new Response(response.body, response);
			response.headers.set("X-Response-Time", `${end - start}`);
			/**
			 * Always overwritten, never merely defaulted: the header is copied from the
			 * monitored response above, so a target that sets it itself would otherwise be
			 * able to pass its own outcome off as this object's verdict. Same for the wall
			 * time below, which is this object's own measurement and not the target's.
			 */
			response.headers.set(PROBE_OUTCOME_HEADER, "responded");
			response.headers.set(DO_WALL_TIME_HEADER, `${performance.now() - handlerStart}`);

			return response;
		} catch (error) {
			return new Response(null, {
				status: 204,
				headers: {
					[PROBE_OUTCOME_HEADER]: "unreachable",
					"X-Probe-Error": error instanceof Error ? error.message : String(error),
					/**
					 * Reported for a failed probe too: a refused connection or a DNS failure
					 * still occupied the object, and a timing-out endpoint is the expensive
					 * case worth watching rather than the one to stop measuring.
					 */
					[DO_WALL_TIME_HEADER]: `${performance.now() - handlerStart}`,
				},
			});
		}
	}
}
