/**
 * The `GeoFetchDO` Durable Object and the probe it runs: it proxies an outbound `fetch` while
 * measuring how long it takes, exposing the elapsed milliseconds via an `X-Response-Time`
 * header. The object is pinned to a location hint, so a check runs from a chosen region.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DurableObject } from "cloudflare:workers";

/** Response header naming what happened to the proxied request. */
export const PROBE_OUTCOME_HEADER = "X-Probe-Outcome";

/**
 * Request header asking this object not to follow redirects, stripped before the proxied
 * request goes out so the monitored target never sees it. Exists for the public trial: a
 * stranger's URL could redirect past the pre-probe hostname check straight to cloud metadata.
 */
export const NO_REDIRECT_HEADER = "X-No-Redirect";

/**
 * Response header carrying how long this object's handler ran, in milliseconds — a lower
 * bound on the billed window, not the billed figure: it excludes time before dispatch and
 * after the response starts streaming, which Cloudflare's own billing includes.
 */
export const DO_WALL_TIME_HEADER = "X-DO-Wall-Time";

/**
 * Proxies one probe request and stamps its outcome and timings on the response. A failed
 * request resolves as a 204 tagged `unreachable`, so the caller tells a down target apart
 * from a fault in the Durable Object running this.
 *
 * @param request The probe as the HTTP check built it, `X-No-Redirect` included.
 */
export async function proxyProbe(request: Request): Promise<Response> {
	/** Opens the billed window; `start` below opens the narrower probe window. */
	let handlerStart = performance.now();

	/**
	 * Consumed here because it is an instruction to this object, and a monitored
	 * endpoint has no business seeing which of our callers asked for it.
	 */
	let followRedirects = request.headers.get(NO_REDIRECT_HEADER) === null;
	if (!followRedirects) {
		request = new Request(request);
		request.headers.delete(NO_REDIRECT_HEADER);
	}

	try {
		let start = performance.now();
		/**
		 * Redirect mode `manual` returns a redirect as the 3xx response it is,
		 * letting the caller classify it as distinct from the target being unreachable.
		 */
		let response = await fetch(request, { redirect: followRedirects ? "follow" : "manual" });
		let end = performance.now();

		response = new Response(response.body, response);
		response.headers.set("X-Response-Time", `${end - start}`);
		/**
		 * Set unconditionally, so this handler's own verdict always overrides
		 * any value already present on the target's response, keeping the
		 * header trustworthy as this object's outcome.
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
				 * Reported for a failed probe too: a refused connection or a DNS
				 * failure still occupied the object, and a timing-out endpoint is
				 * the case most worth watching.
				 */
				[DO_WALL_TIME_HEADER]: `${performance.now() - handlerStart}`,
			},
		});
	}
}

/** One region-pinned probe runner; every request it receives is a probe to proxy. */
export class GeoFetchDO extends DurableObject<Cloudflare.Env> {
	/** Proxies the probe, answering a failed target with a 204 tagged `unreachable`. */
	override async fetch(request: Request): Promise<Response> {
		return await proxyProbe(request);
	}
}
