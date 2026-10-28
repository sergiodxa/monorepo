/**
 * Test helpers: a memory facilitator and a signed payment header that settles
 * against it, so route tests never need a chain or a real wallet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PaymentPayload, PaymentRequirements } from "./types.js";

import { MemoryFacilitator } from "./facilitator.js";
import { PAYMENT_SIGNATURE, encodeHeader } from "./headers.js";
import { Seller, type SellerConfig } from "./seller.js";

export { MemoryFacilitator } from "./facilitator.js";

/** Default receive address used in tests. */
export const TEST_PAY_TO = "0x00000000000000000000000000000000000000fe";

/** Default testnet network (Base Sepolia). */
export const TEST_NETWORK = "eip155:84532";

/** Default USDC asset on Base Sepolia. */
export const TEST_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

/**
 * Builds a {@link Seller} wired to {@link MemoryFacilitator} for unit tests.
 *
 * @param overrides - Optional seller config overrides
 */
export function testSeller(overrides: Partial<SellerConfig> = {}): Seller {
	return new Seller({
		facilitator: new MemoryFacilitator(),
		payTo: TEST_PAY_TO,
		network: TEST_NETWORK,
		asset: TEST_ASSET,
		serviceName: "test",
		...overrides,
	});
}

/**
 * Builds a `PAYMENT-SIGNATURE` header value that {@link MemoryFacilitator} accepts
 * for the given requirements.
 *
 * @param requirements - Accept entry the route will charge
 * @param payer - Optional payer address recorded on the payload
 */
export function memoryPaymentSignature(
	requirements: PaymentRequirements,
	payer = "0xbuyer",
): string {
	let payload: PaymentPayload = {
		x402Version: 2,
		accepted: requirements,
		payload: { payer, simulated: true },
	};
	return encodeHeader(payload);
}

/**
 * Headers object carrying a memory payment signature for `fetch` in tests.
 *
 * @param requirements - Accept entry the route will charge
 */
export function withMemoryPayment(requirements: PaymentRequirements): HeadersInit {
	return { [PAYMENT_SIGNATURE]: memoryPaymentSignature(requirements) };
}
