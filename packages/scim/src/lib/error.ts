/**
 * The one error type every SCIM operation in this package fails with. It carries what the
 * RFC 7644 §3.12 error document needs, so any failure answers through `errorResponse`
 * directly at the call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Scim } from "../index.js";

/** Options accepted by the `ScimError` constructor. */
export interface ScimErrorOptions {
	/** The RFC 7644 §3.12 detail code; RFC 7644 defines it only for `400` and `409`. */
	scimType?: Scim.ErrorType;
}

/**
 * A SCIM refusal: the HTTP status, the RFC 7644 §3.12 `scimType` when one applies, and the
 * human-readable `detail` as the message.
 */
export class ScimError extends Error {
	override name = "ScimError";

	/** The HTTP status the error document and its response carry. */
	readonly status: number;

	/** The machine-readable reason; `null` for statuses RFC 7644 gives no `scimType`. */
	readonly scimType: Scim.ErrorType | null;

	/**
	 * @param status - The HTTP status to answer with
	 * @param detail - The explanation a directory administrator reads in the client's log
	 * @param options - The `scimType`, when the status has one
	 */
	constructor(status: number, detail: string, options: ScimErrorOptions = {}) {
		super(detail);
		this.status = status;
		this.scimType = options.scimType ?? null;
	}
}

/**
 * A `400` refusal with the given `scimType`, the shape nearly every parser here fails with.
 *
 * @param scimType - The RFC 7644 §3.12 detail code
 * @param detail - The explanation
 * @returns The error
 */
export function badRequest(scimType: Scim.ErrorType, detail: string): ScimError {
	return new ScimError(400, detail, { scimType });
}
