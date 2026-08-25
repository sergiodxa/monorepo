/**
 * The caller budget for the MCP endpoint.
 *
 * The endpoint is public, unauthenticated, and every search reads the whole published
 * corpus's metadata, so it needs a bound that does not depend on anyone behaving well.
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
 * Exported because `/mcp`'s own page states it, and a documented limit that disagrees with
 * the enforced one is worse than an undocumented one.
 *
 * Mirrors the `simple.limit` on the `MCP_RATE_LIMITER` binding in `wrangler.jsonc`, kept in
 * step by hand because the binding reports neither value back. Sixty a minute is an abuse
 * bound rather than a product one: an agent answering a question makes a handful of calls
 * and then thinks, so this is far above any real use and hostile to a script.
 */
export const MCP_RATE_LIMIT = 60;

/** Length of the budget's window; matches the binding's `simple.period` of 60. */
const WINDOW = "1 minute";

/** Key namespace, kept stable so counters survive a deploy. */
const PREFIX = "mcp";

/**
 * Creates middleware spending one caller's budget before the MCP handler runs.
 *
 * Keyed on the client address, which is all an anonymous endpoint has to go on. Callers
 * behind one egress share a bucket; that is the cost of having no credential to key on, and
 * the limit is set high enough that it is not a problem in practice.
 *
 * A Cloudflare rate-limiter binding rather than a KV counter, because this endpoint bills
 * nothing per call: a KV read plus write per counted request would cost several times the
 * request being protected, so the protection would cost more than the abuse.
 *
 * @param env Environment bindings, read for the rate limiter.
 * @returns Middleware that limits the request, or a pass-through when the deployment
 * declares no limiter — a deploy predating the binding, or a local run without it, keeps
 * serving rather than refusing everything.
 */
export default function mcpRateLimit(env: App.Env): Middleware {
	let binding = env.MCP_RATE_LIMITER;
	if (!binding) return (_ctx, next) => next();

	return rateLimit({
		adapter: new CloudflareAdapter(binding, { limit: MCP_RATE_LIMIT, window: WINDOW }),
		prefix: PREFIX,
	});
}
