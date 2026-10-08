/**
 * The caller budget for the ActivityPub inbox, which any server may POST to: one budget
 * per client network (an IPv4 address or an IPv6 /64), roomy enough for a busy instance
 * delivering a thread's replies, so one sender cannot flood the inbox queue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";

/**
 * Deliveries one network may send per {@link WINDOW}. Kept equal by hand to the
 * `ACTIVITYPUB_RATE_LIMITER` binding's `simple.limit` in `wrangler.jsonc`.
 */
export const ACTIVITYPUB_RATE_LIMIT = 300;

/** Matches the binding's `simple.period` of 60. */
const WINDOW = "1 minute";

/** Bucket for a request arriving with no readable address, so it is limited too. */
const UNKNOWN = "unknown";

/**
 * Creates the inbox's per-network limit.
 *
 * @param env Environment bindings, read for the rate limiter.
 * @returns The limiting middleware, or none when the deployment declares no limiter, so a
 * local run without the binding keeps accepting deliveries.
 */
export default function activityPubRateLimit(env: App.Env): Middleware[] {
	let binding = env.ACTIVITYPUB_RATE_LIMITER;
	if (!binding) return [];

	let adapter = new CloudflareAdapter(binding, { limit: ACTIVITYPUB_RATE_LIMIT, window: WINDOW });
	return [
		rateLimit({
			adapter,
			prefix: "activitypub:ip",
			key: (ctx) => ctx.ip?.network({ v4: 32, v6: 64 }).toString() ?? UNKNOWN,
		}),
	];
}
