/**
 * The burst catch in front of the agent endpoint.
 *
 * Keyed on the token that arrived rather than on the address it came from: an agent's
 * egress is a datacenter shared with everybody else's, so an address bounds nobody's bill
 * in particular. The day's budget is spent inside the reader's own object, which is what
 * counts accurately; this is what stops a retry loop inside a minute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";

import { agentOf } from "~/app/mcp/agent";

/**
 * Requests one token may spend per {@link WINDOW}.
 *
 * Kept equal by hand to the `MCP_RATE_LIMITER` binding's `simple.limit` in `wrangler.jsonc`,
 * the sole place that value is set; drift leaves the limiting correct and the headers wrong.
 */
export const AGENT_RATE_LIMIT = 60;

/** Length of the budget's window; matches the binding's `simple.period` of 60. */
const WINDOW = "1 minute";

/** Key namespace, kept stable so counters survive a deploy. */
const PREFIX = "mcp";

/**
 * Creates middleware spending one token's burst budget before the protocol handler runs.
 *
 * It stays after the credential middleware, since the token id it keys on is what that
 * middleware publishes — an identity the caller cannot mint a fresh bucket by varying.
 *
 * @param env - The Worker's bindings, read for the rate limiter.
 * @returns Middleware that limits the request, or a pass-through for a deployment that
 * declares no limiter, which is a local run and a deploy predating the binding.
 */
export default function agentRateLimit(env: Cloudflare.Env): Middleware {
	let binding = env.MCP_RATE_LIMITER;
	if (!binding) return (_ctx, next) => next();

	return rateLimit({
		adapter: new CloudflareAdapter(binding, { limit: AGENT_RATE_LIMIT, window: WINDOW }),
		prefix: PREFIX,
		key: (ctx) => agentOf(ctx).tokenId,
	});
}
