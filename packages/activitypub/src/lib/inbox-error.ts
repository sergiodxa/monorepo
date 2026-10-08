/**
 * Why an inbound request was refused: one code per verification step, each with the HTTP
 * status the inbox answers, so a sender learns from a `401` to fall back to another
 * signature scheme while the log keeps the reason the response leaves out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ActivityPubError } from "../errors.js";

/**
 * The step of `receive` or `verifyFetch` that stopped a request. `ignored` is the one code
 * answered with `202`: a `Delete` of an account whose key is gone, which no one can verify
 * and every retry would repeat.
 */
export type InboxErrorCode =
	| "unsupported-media-type"
	| "too-large"
	| "invalid-activity"
	| "blocked"
	| "unsigned"
	| "digest-mismatch"
	| "stale-signature"
	| "invalid-signature"
	| "key-unavailable"
	| "actor-mismatch"
	| "ignored";

/** The status each code is answered with. */
const STATUS: Record<InboxErrorCode, number> = {
	"unsupported-media-type": 415,
	"too-large": 413,
	"invalid-activity": 400,
	blocked: 403,
	unsigned: 401,
	"digest-mismatch": 401,
	"stale-signature": 401,
	"invalid-signature": 401,
	"key-unavailable": 401,
	"actor-mismatch": 401,
	ignored: 202,
};

/**
 * The text a response carries for each code. It names the failed rule and nothing a
 * sender could probe the verifier with; the error's own `message` and `cause` hold the rest.
 */
export const PUBLIC_MESSAGE: Record<InboxErrorCode, string> = {
	"unsupported-media-type": "The body must be application/activity+json or application/ld+json.",
	"too-large": "The body is too large.",
	"invalid-activity": "The body is not an ActivityStreams activity.",
	blocked: "Requests from this server are not accepted.",
	unsigned: "The request must carry an HTTP signature.",
	"digest-mismatch": "The body does not match the signed digest.",
	"stale-signature": "The signature is outside the accepted time window.",
	"invalid-signature": "The signature could not be verified.",
	"key-unavailable": "The signature could not be verified.",
	"actor-mismatch": "The signature does not belong to the activity's actor.",
	ignored: "",
};

/**
 * A request the inbox refuses, with the status to answer it with. It never retries: the
 * same request fails the same way, and only the sender can change it.
 */
export class InboxError extends ActivityPubError<InboxErrorCode> {
	override name = "InboxError";
	/** The HTTP status `rejected` answers with. */
	readonly status: number;

	/**
	 * @param code - The step that failed.
	 * @param message - The explanation a log shows; responses carry a fixed text instead.
	 * @param options - The underlying error.
	 */
	constructor(code: InboxErrorCode, message: string, options: { cause?: unknown } = {}) {
		super(code, message, { cause: options.cause });
		this.status = STATUS[code];
	}
}
