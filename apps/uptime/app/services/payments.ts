/**
 * Whether the guest probe collects x402. Soft-launch sets `X402_FACILITATOR_URL`
 * to `memory` (or leaves it empty) so the route serves for free until a real
 * facilitator URL is configured; Vitest's `test-*` stubs keep charging through
 * the in-memory facilitator so settlement tests still exercise 402.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

/** Optional x402 secrets declared beside the Worker env. */
interface X402Env {
	X402_FACILITATOR_URL?: string;
}

/**
 * True when the guest probe must collect payment.
 *
 * Soft-launch (`memory` / empty / unset) answers false. Any other value —
 * including Vitest's `test-*` stubs and a real `https://…` facilitator —
 * answers true.
 */
export function paymentsEnabled(): boolean {
	return isPaymentsFacilitatorUrl(readOptional("X402_FACILITATOR_URL"));
}

/**
 * Whether a facilitator URL means "charge callers".
 *
 * @param url - Raw `X402_FACILITATOR_URL`, or `null` when unset
 */
export function isPaymentsFacilitatorUrl(url: string | null): boolean {
	if (url === null || url === "" || url === "memory") return false;
	return true;
}

/**
 * Reads an optional x402 secret that may be unset in local/dev stubs.
 *
 * @param name - Binding name
 */
function readOptional(name: keyof X402Env): string | null {
	try {
		let value = (env as X402Env)[name];
		if (typeof value !== "string") return null;
		let trimmed = value.trim();
		return trimmed === "" ? null : trimmed;
	} catch {
		return null;
	}
}
