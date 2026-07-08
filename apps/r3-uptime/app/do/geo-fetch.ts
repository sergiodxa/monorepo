/**
 * A Cloudflare Durable Object that proxies an outbound `fetch` while measuring how long
 * it takes, exposing the elapsed milliseconds via an `X-Response-Time` response header.
 * Because a DO can be pinned to a geographic location hint, it lets the ping workflow
 * issue monitor checks from a chosen region and record their response times.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DurableObject } from "cloudflare:workers";

export class GeoFetchDO extends DurableObject<Cloudflare.Env> {
	override async fetch(request: Request): Promise<Response> {
		let start = performance.now();
		let response = await fetch(request);
		let end = performance.now();

		response = new Response(response.body, response);
		response.headers.set("X-Response-Time", `${end - start}`);

		return response;
	}
}
