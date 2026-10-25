/**
 * The failures a lookup returns, one class per meaning, so a caller tells "the name is
 * gone" from "the resolver is down" with `instanceof` instead of matching messages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DoH } from "./types.js";

/** Every failure `resolve` returns; `instanceof` on it narrows to a lookup failure. */
export class DoHError extends Error {
	override name = "DoHError";
}

/** A failure the resolver answered with a DNS message, so it may say why with RFC 8914 extended errors. */
export class AnsweredError extends DoHError {
	override name = "AnsweredError";

	/** The resolver's RFC 8914 extended errors; a `json` resolver's are always empty. */
	readonly extendedErrors: DoH.ExtendedError[];

	/**
	 * @param message - What went wrong, the first extended error appended when there is one.
	 * @param extendedErrors - The extended errors the answer carried.
	 */
	constructor(message: string, extendedErrors: DoH.ExtendedError[]) {
		let [first] = extendedErrors;
		super(first ? `${message}; extended error ${describe(first)}` : message);
		this.extendedErrors = extendedErrors;
	}
}

/** An extended error as one phrase: its code, and the resolver's text when it sent some. */
function describe(error: DoH.ExtendedError): string {
	return error.text ? `${error.code}: ${error.text}` : String(error.code);
}

/** RCODE 3 (NXDOMAIN): the name does not exist. */
export class NameNotFoundError extends AnsweredError {
	override name = "NameNotFoundError";

	/**
	 * Seconds the absence may be cached: the smaller of the SOA's TTL and its minimum
	 * (RFC 2308), or `null` when the answer carried no SOA.
	 */
	readonly ttl: number | null;

	/** The AD flag: the resolver validated the denial of existence with DNSSEC. */
	readonly authenticated: boolean;

	/**
	 * @param queried - The name that was looked up.
	 * @param ttl - The negative-caching TTL, when known.
	 * @param authenticated - Whether the answer carried the AD flag.
	 * @param extendedErrors - The answer's RFC 8914 extended errors.
	 */
	constructor(
		queried: string,
		ttl: number | null,
		authenticated = false,
		extendedErrors: DoH.ExtendedError[] = [],
	) {
		super(`${queried} does not exist (NXDOMAIN)`, extendedErrors);
		this.ttl = ttl;
		this.authenticated = authenticated;
	}
}

/** RCODE 2 (SERVFAIL): the resolver could not answer, a DNSSEC validation failure included. */
export class ServerFailureError extends AnsweredError {
	override name = "ServerFailureError";

	/**
	 * @param queried - The name that was looked up.
	 * @param extendedErrors - The answer's RFC 8914 extended errors, such as `6` for DNSSEC Bogus.
	 */
	constructor(queried: string, extendedErrors: DoH.ExtendedError[] = []) {
		super(`The resolver failed to answer for ${queried} (SERVFAIL)`, extendedErrors);
	}
}

/** Any other non-zero RCODE: FORMERR, NOTIMP, REFUSED and the rest. */
export class ResponseCodeError extends AnsweredError {
	override name = "ResponseCodeError";

	readonly rcode: number;

	/**
	 * @param queried - The name that was looked up.
	 * @param rcode - The DNS response code the resolver returned, extended RCODEs included.
	 * @param extendedErrors - The answer's RFC 8914 extended errors.
	 */
	constructor(queried: string, rcode: number, extendedErrors: DoH.ExtendedError[] = []) {
		super(`The resolver answered ${queried} with response code ${rcode}`, extendedErrors);
		this.rcode = rcode;
	}
}

/** The request produced no DNS answer: a network error, a timeout, a non-2xx, or a body that is not the envelope. */
export class TransportError extends DoHError {
	override name = "TransportError";

	/** The HTTP status when a response arrived, `null` when none did. */
	readonly status: number | null;

	/**
	 * @param message - What went wrong.
	 * @param status - The HTTP status, when a response arrived.
	 * @param options - The underlying error.
	 */
	constructor(message: string, status: number | null, options?: ErrorOptions) {
		super(message, options);
		this.status = status;
	}
}
