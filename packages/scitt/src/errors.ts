/**
 * The errors this package reports: `SCITTError` for a Signed Statement or Receipt that does
 * not read or verify, `ServiceError` for a Transparency Service exchange that does not
 * complete, each with a code to branch on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { COSEErrorCode } from "@sdxc/cbor/cose";

/**
 * Why a statement or receipt failed: any COSE failure (`malformed`, `invalid-signature`, …),
 * a `missing-claim` SCITT requires, an `unsupported-vds`, an `invalid-proof` that does not
 * reach the signed root, an `unknown-key` the receipt names, or an `untrusted-issuer`.
 */
export type SCITTErrorCode =
	| COSEErrorCode
	| "missing-claim"
	| "unsupported-vds"
	| "invalid-proof"
	| "unknown-key"
	| "untrusted-issuer";

/** A Signed Statement, Receipt or Transparent Statement failure. */
export class SCITTError extends Error {
	override name = "SCITTError";

	/** Which rule failed, so a caller can branch without reading `message`. */
	code: SCITTErrorCode;

	/**
	 * @param code What went wrong
	 * @param message The failure in words
	 */
	constructor(code: SCITTErrorCode, message: string) {
		super(message);
		this.code = code;
	}
}

/**
 * Why a Transparency Service exchange failed: the service answered with an `error-response`
 * (its problem details in `title` and `detail`), an `invalid-response` this client cannot
 * read, a `network-error`, or registration still `pending` after the last poll.
 */
export type ServiceErrorCode = "error-response" | "invalid-response" | "network-error" | "pending";

/** A failed exchange with a Transparency Service. */
export class ServiceError extends Error {
	override name = "ServiceError";

	/** Which way the exchange failed. */
	code: ServiceErrorCode;

	/** HTTP status of the response, when there was one. */
	status: number | undefined;

	/** The Concise Problem Details title, when the service sent one. */
	title: string | undefined;

	/** The Concise Problem Details detail, when the service sent one. */
	detail: string | undefined;

	/** Milliseconds the service asked the client to wait before retrying, from `Retry-After`. */
	retryAfter: number | undefined;

	/**
	 * @param code What went wrong
	 * @param message The failure in words
	 * @param fields What the response said about it
	 */
	constructor(
		code: ServiceErrorCode,
		message: string,
		fields: {
			status?: number;
			title?: string;
			detail?: string;
			retryAfter?: number;
			cause?: unknown;
		} = {},
	) {
		super(message, { cause: fields.cause });
		this.code = code;
		this.status = fields.status;
		this.title = fields.title;
		this.detail = fields.detail;
		this.retryAfter = fields.retryAfter;
	}
}
