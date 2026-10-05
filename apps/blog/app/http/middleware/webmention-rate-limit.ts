/**
 * The caller budget for the Webmention endpoint, which is anonymous by definition:
 * one budget per client network (an IPv4 address or an IPv6 /64) and one per source host,
 * so neither a single sender nor a site spraying from many addresses floods the verify queue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import { CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";

/**
 * Requests one address, or one source host, may send per {@link WINDOW}. Kept equal by
 * hand to the `WEBMENTION_RATE_LIMITER` binding's `simple.limit` in `wrangler.jsonc`.
 */
export const WEBMENTION_RATE_LIMIT = 30;

/** Matches the binding's `simple.period` of 60. */
const WINDOW = "1 minute";

/** Bucket for a request arriving with no address or no readable source, so it is limited too. */
const UNKNOWN = "unknown";

/**
 * The source host a request names, read from the body the `formData()` middleware
 * already parsed; a missing or unparseable source shares the one {@link UNKNOWN} bucket.
 */
function sourceHost(ctx: RequestContext): string {
	let source = ctx.get(FormData)?.get("source");
	if (typeof source !== "string") return UNKNOWN;
	try {
		return new URL(source).hostname || UNKNOWN;
	} catch {
		return UNKNOWN;
	}
}

/**
 * Creates the two limits the endpoint runs behind, both counted by the one binding
 * under separate key prefixes so the budgets never mix.
 *
 * @param env Environment bindings, read for the rate limiter.
 * @returns The limiting middleware, or none when the deployment declares no limiter, so
 * a local run without the binding keeps accepting mentions.
 */
export default function webmentionRateLimit(env: App.Env): Middleware[] {
	let binding = env.WEBMENTION_RATE_LIMITER;
	if (!binding) return [];

	let adapter = new CloudflareAdapter(binding, { limit: WEBMENTION_RATE_LIMIT, window: WINDOW });
	return [
		rateLimit({
			adapter,
			prefix: "webmention:ip",
			key: (ctx) => ctx.ip?.network({ v4: 32, v6: 64 }).toString() ?? UNKNOWN,
		}),
		rateLimit({ adapter, prefix: "webmention:source", key: sourceHost }),
	];
}
