/**
 * The caller budget for the MCP endpoint.
 *
 * The endpoint is public, unauthenticated, and every search reads the whole published
 * corpus's metadata, so it needs a bound enforced regardless of how any caller behaves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { CloudflareAdapter } from "@pkg/rate-limit";
import { rateLimit } from "@pkg/rate-limit/middleware";

/**
 * Requests one caller may spend per {@link WINDOW}.
 *
 * Kept equal by hand to the `MCP_RATE_LIMITER` binding's `simple.limit` in `wrangler.jsonc`,
 * the sole place that value is set; set high to catch abuse, well above ordinary use.
 */
export const MCP_RATE_LIMIT = 60;

/** Length of the budget's window; matches the binding's `simple.period` of 60. */
const WINDOW = "1 minute";

/** Key namespace, kept stable so counters survive a deploy. */
const PREFIX = "mcp";

/**
 * Creates middleware spending one caller's budget before the MCP handler runs.
 *
 * Keyed on the client address, all an anonymous endpoint has; shared egress means shared
 * buckets. A Cloudflare rate-limiter binding holds the count at no storage cost per call.
 *
 * @param env Environment bindings, read for the rate limiter.
 * @returns Middleware that limits the request, or a pass-through that keeps serving when the
 * deployment declares no limiter — a deploy predating the binding, or a local run without it.
 */
export default function mcpRateLimit(env: App.Env): Middleware {
	let binding = env.MCP_RATE_LIMITER;
	if (!binding) return (_ctx, next) => next();

	return rateLimit({
		adapter: new CloudflareAdapter(binding, { limit: MCP_RATE_LIMIT, window: WINDOW }),
		prefix: PREFIX,
	});
}
