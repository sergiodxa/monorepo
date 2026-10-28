/**
 * Builds the x402 seller for this isolate: memory facilitator when the facilitator
 * secret is empty or `memory`, otherwise an HTTP facilitator.
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
 * Seller config for the router middleware. Secrets come from the Worker env;
 * a missing, `memory`, or non-http facilitator URL selects the memory facilitator
 * so Vitest's `test-<KEY>` stubs and bare local runs settle without a chain.
 */
export function sellerConfig(): SellerConfig {
	let facilitatorUrl = readOptional("X402_FACILITATOR_URL");
	let facilitator: Facilitator = isHttpFacilitatorUrl(facilitatorUrl)
		? new HTTPFacilitator({ url: facilitatorUrl })
		: new MemoryFacilitator();

	return {
		facilitator,
		payTo: readOptional("X402_PAY_TO") ?? DEFAULT_PAY_TO,
		network: readOptional("X402_NETWORK") ?? DEFAULT_NETWORK,
		asset: readOptional("X402_ASSET") ?? DEFAULT_ASSET,
		serviceName: "sdxc-api",
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
 * Reads a secret that may be unset in local/dev stubs.
 *
 * @param name - Binding name
 */
function readOptional(name: keyof Cloudflare.Env): string | null {
	try {
		let value = env[name];
		if (typeof value !== "string") return null;
		let trimmed = value.trim();
		return trimmed === "" ? null : trimmed;
	} catch {
		return null;
	}
}
