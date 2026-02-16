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
