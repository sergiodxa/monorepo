/**
 * The caller budget for the two endpoints anyone can reach without identifying themselves:
 * the submit form and the MCP endpoint. Keyed on the connecting address, which is all an
 * anonymous endpoint has, so callers sharing an egress address share a budget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { getClientIP } from "@sdxc/get-client-ip";
import { MemoryAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";

/** Bucket for a request arriving with no address, so it is limited rather than exempt. */
const UNKNOWN_CALLER = "unknown";

/**
 * Creates middleware spending one caller's budget before the handler runs.
 *
 * @param prefix Key namespace, so the submit budget and the MCP budget count separately.
 * @param limit Requests one caller may spend per minute.
 */
export default function callerBudget(prefix: string, limit: number): Middleware {
	return rateLimit({
		adapter: new MemoryAdapter({ limit, window: "1 minute" }),
		prefix,
		key: (ctx) => getClientIP(ctx.request) ?? UNKNOWN_CALLER,
	});
}
