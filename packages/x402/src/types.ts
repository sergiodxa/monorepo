/**
 * x402 V2 payment shapes the seller speaks: requirements advertised on 402,
 * payloads clients sign, and settlement receipts returned after facilitator settle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** What the paid resource is, for clients and discovery indexes. */
export interface ResourceInfo {
	/** Absolute URL of the resource being sold. */
	url: string;
	/** Short human description of what payment unlocks. */
	description?: string;
	/** Response media type when known up front. */
	mimeType?: string;
	/** Service name shown in catalogs. */
	serviceName?: string;
}

/** One accepted way to pay for a resource (scheme + network + amount). */
export interface PaymentRequirements {
	/** Payment scheme, e.g. `exact`. */
	scheme: string;
	/** CAIP-2 network id, e.g. `eip155:84532`. */
	network: string;
	/** Atomic token amount as a decimal string. */
	amount: string;
	/** Asset contract address or native asset id. */
	asset: string;
	/** Destination wallet that receives funds. */
	payTo: string;
	/** Seconds the client may take to retry with a signature. */
	maxTimeoutSeconds: number;
	/** Scheme-specific fields the facilitator expects. */
	extra?: Record<string, unknown> | null;
}

/** Body encoded into the `PAYMENT-REQUIRED` header on a 402. */
export interface PaymentRequired {
	/** Protocol version; this package speaks `2`. */
	x402Version: 2;
	/** Optional machine-readable refusal reason on a failed settle. */
	error?: string;
	/** The resource the client asked for. */
	resource: ResourceInfo;
	/** Payment options the seller will accept. */
	accepts: PaymentRequirements[];
	/** Optional protocol extensions. */
	extensions?: Record<string, unknown>;
}

/** Body encoded into the `PAYMENT-SIGNATURE` header on the paid retry. */
export interface PaymentPayload {
	/** Protocol version the client used. */
	x402Version: number;
	/** Resource the payload was built for, when the client includes it. */
	resource?: ResourceInfo;
	/** The accept entry the client chose to pay. */
	accepted: PaymentRequirements;
	/** Scheme-specific signed authorization. */
	payload: Record<string, unknown>;
	/** Optional protocol extensions. */
	extensions?: Record<string, unknown>;
}

/** Facilitator answer to `/verify`. */
export interface VerifyResponse {
	/** Whether the payload meets the requirements. */
	isValid: boolean;
	/** Stable machine reason when invalid. */
	invalidReason?: string;
	/** Human message when invalid. */
	invalidMessage?: string;
	/** Payer address when known. */
	payer?: string;
}

/** Facilitator answer to `/settle`. */
export interface SettleResponse {
	/** Whether settlement completed. */
	success: boolean;
	/** Stable machine reason when it failed. */
	errorReason?: string;
	/** Human message when it failed. */
	errorMessage?: string;
	/** Payer address when known. */
	payer?: string;
	/** On-chain transaction id, or a stand-in from a memory facilitator. */
	transaction: string;
	/** Network the settlement ran on. */
	network: string;
	/** Atomic amount settled when it can differ from the authorized max. */
	amount?: string;
}

/** Receipt published on the request after a successful settle. */
export interface PaymentReceipt {
	/** Payer address when the facilitator reported one. */
	payer?: string;
	/** Settlement transaction id. */
	transaction: string;
	/** Network the payment settled on. */
	network: string;
	/** Atomic amount charged. */
	amount: string;
	/** Asset that was charged. */
	asset: string;
	/** Scheme used. */
	scheme: string;
}
