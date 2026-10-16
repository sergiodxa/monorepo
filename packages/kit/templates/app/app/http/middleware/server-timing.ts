/**
 * Publishes a `Server-Timing` collector on every request as `ctx.timing` and writes what it
 * measured onto the response, so browser devtools show where a request spent its time:
 * `await ctx.timing.measure("db", "listPosts", () => listPosts())`.
 */

import type { Middleware } from "remix/router";

import { TimingCollector } from "@sdxc/server-timing";
import { createContextKey } from "remix/router";

declare module "remix/router" {
	interface RequestContext {
		/** The request's timings, sent as its `Server-Timing` header. */
		timing: TimingCollector;
	}
}

/** Reads the request's collector by key, for code holding a context whose chain is unknown. */
export const Timing: { defaultValue?: TimingCollector } = createContextKey<TimingCollector>();

/**
 * Creates the middleware. The whole request is measured as `app`, recorded after every entry a
 * handler adds; the header goes on a copy of the response, so a redirect or a proxied
 * response with immutable headers carries it too.
 */
export default function serverTiming(): Middleware<{
	key: typeof Timing;
	value: TimingCollector;
	property: "timing";
}> {
	return async (ctx, next) => {
		let timing = new TimingCollector();
		ctx.set(Timing, timing, { property: "timing" });
		let response = await timing.measure("app", "", () => next());
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: timing.toHeaders(new Headers(response.headers)),
		});
	};
}
