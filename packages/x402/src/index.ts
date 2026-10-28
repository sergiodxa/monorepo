/**
 * x402 seller surface for Remix apps: payment header codecs, facilitator clients,
 * a {@link Seller} that challenges and collects, and typed payment shapes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	BazaarExtension,
	BazaarHttpPostInput,
	BazaarInfo,
	BazaarMcpInput,
	BazaarOutput,
} from "./bazaar.js";
export type { Facilitator, HTTPFacilitatorOptions } from "./facilitator.js";
export type { X402ErrorCode } from "./errors.js";
export type { PriceRequest, SellerConfig } from "./seller.js";
export type {
	PaymentPayload,
	PaymentReceipt,
	PaymentRequired,
	PaymentRequirements,
	ResourceInfo,
	SettleResponse,
	VerifyResponse,
} from "./types.js";

export { bazaarHttpPost, bazaarMcpTool } from "./bazaar.js";
export { X402Error } from "./errors.js";
export { HTTPFacilitator, MemoryFacilitator } from "./facilitator.js";
export {
	PAYMENT_REQUIRED,
	PAYMENT_REQUIRED_CACHE_CONTROL,
	PAYMENT_RESPONSE,
	PAYMENT_SIGNATURE,
	decodeHeader,
	decodePaymentSignature,
	encodeHeader,
	encodePaymentRequired,
	encodePaymentResponse,
} from "./headers.js";
export { Seller } from "./seller.js";
