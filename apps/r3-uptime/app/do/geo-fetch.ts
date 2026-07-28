/**
 * A Cloudflare Durable Object that proxies an outbound `fetch` while measuring how long
 * it takes, exposing the elapsed milliseconds via an `X-Response-Time` response header.
 * Because a DO can be pinned to a geographic location hint, it lets the ping job issue
 * monitor checks from a chosen region and record their response times.
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

export class GeoFetchDO extends DurableObject<Cloudflare.Env> {
	override async fetch(request: Request): Promise<Response> {
		let start = performance.now();

		try {
			let response = await fetch(request);
			let end = performance.now();

			response = new Response(response.body, response);
			response.headers.set("X-Response-Time", `${end - start}`);
			/**
			 * Always overwritten, never merely defaulted: the header is copied from the
			 * monitored response above, so a target that sets it itself would otherwise be
			 * able to pass its own outcome off as this object's verdict.
			 */
			response.headers.set(PROBE_OUTCOME_HEADER, "responded");

			return response;
		} catch (error) {
			return new Response(null, {
				status: 204,
				headers: {
					[PROBE_OUTCOME_HEADER]: "unreachable",
					"X-Probe-Error": error instanceof Error ? error.message : String(error),
				},
			});
		}
	}
}
