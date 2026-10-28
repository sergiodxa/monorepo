/**
 * Base64 JSON codecs for the three x402 V2 payment headers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { PaymentPayload, PaymentRequired, SettleResponse } from "./types.js";

import { X402Error } from "./errors.js";

/** Request header carrying the client's signed payment. */
export const PAYMENT_SIGNATURE = "PAYMENT-SIGNATURE";

/** Response header advertising what to pay. */
export const PAYMENT_REQUIRED = "PAYMENT-REQUIRED";

/** Response header carrying settlement outcome. */
export const PAYMENT_RESPONSE = "PAYMENT-RESPONSE";

/** Cache directive so intermediaries never store a 402 challenge. */
export const PAYMENT_REQUIRED_CACHE_CONTROL = "no-store";

/**
 * Encodes a JSON value as a Base64 header body.
 *
 * @param value - Any JSON-serializable value
 * @returns Base64 of the UTF-8 JSON
 */
export function encodeHeader(value: unknown): string {
	return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}

/**
 * Decodes a Base64 header body as JSON.
 *
 * @param header - Raw header value
 * @returns Parsed JSON, or `invalid_header`
 */
export function decodeHeader(header: string): Result<unknown, X402Error> {
	try {
		let json = decodeURIComponent(escape(atob(header.trim())));
		return success(JSON.parse(json) as unknown);
	} catch {
		return failure(new X402Error("invalid_header", "Payment header is not valid Base64 JSON"));
	}
}

/**
 * Builds the `PAYMENT-REQUIRED` header value.
 *
 * @param required - Requirements to advertise
 */
export function encodePaymentRequired(required: PaymentRequired): string {
	return encodeHeader(required);
}

/**
 * Parses a `PAYMENT-SIGNATURE` header into a payment payload.
 *
 * @param header - Raw header value
 */
export function decodePaymentSignature(header: string): Result<PaymentPayload, X402Error> {
	let decoded = decodeHeader(header);
	if (isFailure(decoded)) return decoded;

	let value = decoded.data;
	if (typeof value !== "object" || value === null) {
		return failure(new X402Error("invalid_payload", "Payment signature is not an object"));
	}

	let record = value as Record<string, unknown>;
	if (typeof record.x402Version !== "number") {
		return failure(new X402Error("invalid_payload", "Payment signature missing x402Version"));
	}
	if (typeof record.accepted !== "object" || record.accepted === null) {
		return failure(new X402Error("invalid_payload", "Payment signature missing accepted"));
	}
	if (typeof record.payload !== "object" || record.payload === null) {
		return failure(new X402Error("invalid_payload", "Payment signature missing payload"));
	}

	return success(value as PaymentPayload);
}

/**
 * Builds the `PAYMENT-RESPONSE` header value.
 *
 * @param settlement - Facilitator settle result
 */
export function encodePaymentResponse(settlement: SettleResponse): string {
	return encodeHeader(settlement);
}
