/**
 * Builds the x402 seller used by the accountless guest probe: memory facilitator
 * when the facilitator secret is empty or `memory`, otherwise an HTTP facilitator.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Facilitator, SellerConfig } from "@sdxc/x402";

import { HTTPFacilitator, MemoryFacilitator } from "@sdxc/x402";
import { env } from "cloudflare:workers";

/** Base Sepolia USDC, used when `X402_ASSET` is unset in local development. */
const DEFAULT_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

/** Base Sepolia CAIP-2 id, used when `X402_NETWORK` is unset in local development. */
const DEFAULT_NETWORK = "eip155:84532";

/** Stand-in receive address for local memory settlement. */
const DEFAULT_PAY_TO = "0x00000000000000000000000000000000000000fe";

/**
 * Seller config for the guest-probe route. A missing, `memory`, or non-http
 * facilitator URL selects the memory facilitator so Vitest stubs and bare local
 * runs settle without a chain.
 */
export function sellerConfig(): SellerConfig {
	let facilitatorUrl = readOptional("X402_FACILITATOR_URL");
	let auth = readOptional("X402_FACILITATOR_AUTH");
	let facilitator: Facilitator = isHttpFacilitatorUrl(facilitatorUrl)
		? new HTTPFacilitator({
				url: facilitatorUrl,
				...(auth === null ? {} : { headers: { Authorization: auth } }),
			})
		: new MemoryFacilitator();

	return {
		facilitator,
		payTo: readOptional("X402_PAY_TO") ?? DEFAULT_PAY_TO,
		network: readOptional("X402_NETWORK") ?? DEFAULT_NETWORK,
		asset: readOptional("X402_ASSET") ?? DEFAULT_ASSET,
		serviceName: "uptime",
	};
}

/**
 * True when the configured facilitator is a real HTTP endpoint.
 *
 * @param url - Raw `X402_FACILITATOR_URL` or `null` when unset
 */
function isHttpFacilitatorUrl(url: string | null): url is string {
	if (url === null || url === "" || url === "memory") return false;
	return /^https?:\/\//i.test(url);
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

/** Optional x402 secrets declared beside the Worker env. */
interface X402Env {
	X402_PAY_TO?: string;
	X402_FACILITATOR_URL?: string;
	X402_FACILITATOR_AUTH?: string;
	X402_NETWORK?: string;
	X402_ASSET?: string;
}
