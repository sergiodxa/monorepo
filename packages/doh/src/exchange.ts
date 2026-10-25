/**
 * The HTTP exchange both encodings share, and the response shape each reads its body into,
 * so `resolve` classifies RCODEs and splits answers the same way whichever format the
 * resolver speaks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { DoH } from "./types.js";

import { TransportError } from "./errors.js";

/** One resource record of a response, its data in presentation or RFC 3597 generic form. */
export interface MessageRecord {
	/** Lowercased, without the trailing dot. */
	name: string;
	/** The IANA type code. */
	type: number;
	ttl: number;
	data: string;
}

/** What a response says, read out of either encoding. */
export interface Message {
	/** The full RCODE, the OPT record's extended bits included. */
	rcode: number;
	authenticated: boolean;
	truncated: boolean;
	answer: MessageRecord[];
	authority: MessageRecord[];
	extendedErrors: DoH.ExtendedError[];
}

/** What one query sends: the name and type as asked, and the DNSSEC flags. */
export interface Query {
	name: string;
	/** The canonical mnemonic or `TYPEnnn`. */
	type: string;
	dnssec: boolean;
	checkingDisabled: boolean;
}

/** The signal that aborts a request and the timeout that may be why. */
export interface Deadline {
	signal: AbortSignal;
	timeout: AbortSignal;
	timeoutMs: number;
}

/**
 * Sends one request to the resolver, mapping every way it can fail before a 2xx response
 * arrives, and a body that cannot be read, to a `TransportError`.
 *
 * @param url - The query URL, the question already in it.
 * @param accept - The media type asked for.
 * @param deadline - The caller's abort signal joined with the timeout.
 * @param read - Reads the body, failing when it is not the encoding asked for.
 */
export async function exchange<Body>(
	url: URL,
	accept: string,
	deadline: Deadline,
	read: (response: Response) => Promise<Body>,
): Promise<Result<{ body: Body; status: number }, TransportError>> {
	let response: Response;
	try {
		response = await fetch(url, { headers: { Accept: accept }, signal: deadline.signal });
	} catch (error) {
		let message = deadline.timeout.aborted
			? `The DNS query timed out after ${deadline.timeoutMs}ms`
			: `The DNS query failed: ${error instanceof Error ? error.message : String(error)}`;
		return failure(new TransportError(message, null, { cause: error }));
	}

	if (!response.ok) {
		return failure(
			new TransportError(`The resolver answered HTTP ${response.status}`, response.status),
		);
	}

	try {
		return success({ body: await read(response), status: response.status });
	} catch (error) {
		return failure(
			new TransportError(`The resolver's response is not ${accept}`, response.status, {
				cause: error,
			}),
		);
	}
}
