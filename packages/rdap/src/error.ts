/**
 * The one failure every lookup answers with: a code a caller branches on, whether a
 * later attempt can change it, and the fields that code fills, so a job tells "not
 * registered" from "the registry pushed back" without reading a message.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why a lookup produced no domain. `not-found` and `unsupported-tld` are answers
 * about the name; `rate-limited`, `server-error`, `timeout`, `network` and
 * `bootstrap-unavailable` are the outcomes a later attempt can change.
 */
export type RDAPErrorCode =
	| "invalid-domain"
	| "unsupported-tld"
	| "not-found"
	| "rate-limited"
	| "server-error"
	| "refused"
	| "invalid-response"
	| "too-large"
	| "timeout"
	| "network"
	| "bootstrap-unavailable";

/** The codes a later attempt can clear. */
const RETRYABLE_CODES = new Set<RDAPErrorCode>([
	"rate-limited",
	"server-error",
	"timeout",
	"network",
	"bootstrap-unavailable",
]);

/** The details a failure carries; each code fills the ones its row of the README names. */
export interface RDAPErrorDetails {
	domain?: string;
	tld?: string;
	url?: string;
	status?: number;
	retryAfter?: number;
}

/** Returned inside a `Failure` by every `RDAP` method, never thrown. */
export class RDAPError extends Error {
	override name = "RDAPError";

	readonly code: RDAPErrorCode;

	/** The name as the caller wrote it, for `invalid-domain`. */
	readonly domain: string | null;

	/** The label no server is known for, for `unsupported-tld`. */
	readonly tld: string | null;

	/** The request the failure concerns: the hop that was refused or failed, or the one that answered. */
	readonly url: string | null;

	/** The HTTP status that ended the lookup, when a response arrived. */
	readonly status: number | null;

	/** Milliseconds the server asked the client to wait, from `Retry-After`, when it said. */
	readonly retryAfter: number | null;

	/**
	 * @param code - Why the lookup failed.
	 * @param message - The explanation a log shows.
	 * @param details - The fields the code fills.
	 * @param options - The underlying error, when one caused this.
	 */
	constructor(
		code: RDAPErrorCode,
		message: string,
		details: RDAPErrorDetails = {},
		options?: ErrorOptions,
	) {
		super(message, options);
		this.code = code;
		this.domain = details.domain ?? null;
		this.tld = details.tld ?? null;
		this.url = details.url ?? null;
		this.status = details.status ?? null;
		this.retryAfter = details.retryAfter ?? null;
	}

	/** Whether asking again later can succeed; the caller schedules that attempt. */
	get retryable(): boolean {
		return RETRYABLE_CODES.has(this.code);
	}
}
