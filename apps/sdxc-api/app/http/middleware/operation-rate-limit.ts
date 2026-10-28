/**
 * Caps priced HTTP and MCP traffic per payer when a payment signature is present,
 * otherwise per connecting address, so unpaid 402 probes and paid callers share
 * separate budgets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Adapter, RateLimiterBinding } from "@sdxc/rate-limit";
import type { Middleware, RequestContext } from "remix/router";

import { CloudflareAdapter, MemoryAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { isSuccess } from "@sdxc/result";
import { PAYMENT_SIGNATURE, decodePaymentSignature } from "@sdxc/x402";
import { env } from "cloudflare:workers";

/**
 * Requests one caller may spend per {@link WINDOW}.
 *
 * Kept equal by hand to the `RATE_LIMITER` binding's `simple.limit` in
 * `cloudflare.config.ts`.
 */
export const OPERATION_RATE_LIMIT = 60;

/** Length of the budget's window; matches the binding's `simple.period` of 60. */
const WINDOW = "1 minute";

/** Key namespace, kept stable so counters survive a deploy. */
const PREFIX = "op";

/** Bucket when neither a payer nor an address is known. */
const UNKNOWN_CALLER = "unknown";

/**
 * Middleware that spends one caller's budget before payment collection runs.
 * Uses the Cloudflare binding in production and an in-process adapter when the
 * binding is unset (Vitest stubs and bare local runs).
 */
export function operationRateLimit(): Middleware {
	return rateLimit({
		adapter: createAdapter(),
		prefix: PREFIX,
		key: rateLimitKey,
	});
}

/**
 * Picks the Cloudflare binding when present, otherwise an in-memory adapter with
 * the same declared limit and window so local tests still exercise the headers.
 */
function createAdapter(): Adapter {
	let binding = readRateLimiter();
	if (binding !== null) {
		return new CloudflareAdapter(binding, { limit: OPERATION_RATE_LIMIT, window: WINDOW });
	}
	return new MemoryAdapter({ limit: OPERATION_RATE_LIMIT, window: WINDOW });
}

/**
 * Reads the rate limiter binding when the deployment declares it.
 *
 * @returns The binding, or `null` when unset in stubs
 */
function readRateLimiter(): RateLimiterBinding | null {
	try {
		let value = (env as { RATE_LIMITER?: RateLimiterBinding }).RATE_LIMITER;
		if (value === undefined || value === null) return null;
		if (typeof value.limit !== "function") return null;
		return value;
	} catch {
		return null;
	}
}

/**
 * Keys paid retries by the signature's payer and unpaid probes by network address.
 *
 * @param ctx - Request context after `getClientIP`
 */
function rateLimitKey(ctx: RequestContext): string {
	let header = ctx.request.headers.get(PAYMENT_SIGNATURE);
	if (header !== null && header.trim() !== "") {
		let decoded = decodePaymentSignature(header);
		if (isSuccess(decoded)) {
			let payer = decoded.data.payload.payer;
			if (typeof payer === "string" && payer.trim() !== "") {
				return `payer:${payer.trim().toLowerCase()}`;
			}
		}
	}

	let network = ctx.ip?.network({ v4: 32, v6: 64 }).toString();
	return `ip:${network ?? UNKNOWN_CALLER}`;
}
