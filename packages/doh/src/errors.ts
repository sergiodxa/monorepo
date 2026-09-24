/**
 * The failures a lookup returns, one class per meaning, so a caller tells "the name is
 * gone" from "the resolver is down" with `instanceof` instead of matching messages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Every failure `resolve` returns; `instanceof` on it narrows to a lookup failure. */
export class DoHError extends Error {
	override name = "DoHError";
}

/** RCODE 3 (NXDOMAIN): the name does not exist. */
export class NameNotFoundError extends DoHError {
	override name = "NameNotFoundError";

	/**
	 * Seconds the absence may be cached: the smaller of the SOA's TTL and its minimum
	 * (RFC 2308), or `null` when the answer carried no SOA.
	 */
	readonly ttl: number | null;

	/**
	 * @param queried - The name that was looked up.
	 * @param ttl - The negative-caching TTL, when known.
	 */
	constructor(queried: string, ttl: number | null) {
		super(`${queried} does not exist (NXDOMAIN)`);
		this.ttl = ttl;
	}
}

/** RCODE 2 (SERVFAIL): the resolver could not answer, a DNSSEC validation failure included. */
export class ServerFailureError extends DoHError {
	override name = "ServerFailureError";

	/** @param queried - The name that was looked up. */
	constructor(queried: string) {
		super(`The resolver failed to answer for ${queried} (SERVFAIL)`);
	}
}

/** Any other non-zero RCODE: FORMERR, NOTIMP, REFUSED and the rest. */
export class ResponseCodeError extends DoHError {
	override name = "ResponseCodeError";

	readonly rcode: number;

	/**
	 * @param queried - The name that was looked up.
	 * @param rcode - The DNS response code the resolver returned.
	 */
	constructor(queried: string, rcode: number) {
		super(`The resolver answered ${queried} with response code ${rcode}`);
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

/** RDATA that does not parse for its type; `resolve` keeps such a record in `unparsed`. */
export class RecordDataError extends Error {
	override name = "RecordDataError";
}
