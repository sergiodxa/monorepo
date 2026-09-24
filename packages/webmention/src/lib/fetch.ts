/**
 * The one way this package fetches a page a stranger named: public hosts only, every
 * redirect re-checked, one deadline for the chain and the body, a byte cap counted off
 * the stream, and each failure labelled with whether a retry can help.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Retrieved } from "@sdxc/distill/retrieve";
import type { Result } from "@sdxc/result";

import { addressable, DistillRefusedError, follow, readWithin } from "@sdxc/distill/retrieve";
import { failure, isFailure, success } from "@sdxc/result";

import { WebmentionFetchError } from "../index.js";

/** A megabyte holds any page a mention is written on, and costs little of an isolate's memory. */
export const MAX_BYTES = 1_048_576;

/** Five seconds, since the fetch runs in a background job with retries behind it. */
export const TIMEOUT_MS = 5_000;

/** A page that has moved moves once or twice; five hops is generous. */
export const MAX_REDIRECTS = 5;

/** What a fetch may spend, and the name it asks under. */
export interface Bounds {
	/** Sent on every request, so a publisher can tell who is asking. */
	userAgent: string;
	/** @default 1_048_576 */
	maxBytes?: number | undefined;
	/** @default 5_000 */
	timeoutMs?: number | undefined;
	/** @default 5 */
	maxRedirects?: number | undefined;
}

/** A response, where the chain ended, and the deadline still running over its body. */
export interface Fetched extends Retrieved {
	signal: AbortSignal;
}

/**
 * Requests a page under the bounds and answers the last response of the chain whatever
 * its status. A refused host is final; a timeout, a network failure or an overlong chain
 * may clear up, so those are retryable.
 */
export async function fetchBounded(
	input: URL,
	bounds: Bounds,
): Promise<Result<Fetched, WebmentionFetchError>> {
	let address = addressable(input.href);
	if (isFailure(address)) return failure(new WebmentionFetchError(address.error.message, false));

	let signal = AbortSignal.timeout(bounds.timeoutMs ?? TIMEOUT_MS);
	let followed = await follow(address.data, {
		userAgent: bounds.userAgent,
		maxRedirects: bounds.maxRedirects ?? MAX_REDIRECTS,
		signal,
	});
	if (isFailure(followed)) {
		let retryable = !(followed.error instanceof DistillRefusedError);
		return failure(new WebmentionFetchError(followed.error.message, retryable));
	}

	return success({ ...followed.data, signal });
}

/**
 * Reads a body within the byte cap. Running out of time mid-body is retryable; a body
 * over the cap, or one that broke off, is final.
 */
export async function readBody(
	fetched: Fetched,
	bounds: Bounds,
): Promise<Result<string, WebmentionFetchError>> {
	let read = await readWithin(fetched, bounds.maxBytes ?? MAX_BYTES);
	if (isFailure(read)) {
		return failure(new WebmentionFetchError(read.error.message, fetched.signal.aborted));
	}
	return success(read.data.text);
}

/**
 * The failure a status stands for when asking again later can change it: a server error,
 * or a `429` asking the client to slow down. Any other status is an answer.
 */
export function transientStatus(fetched: Retrieved): WebmentionFetchError | null {
	let { status } = fetched.response;
	if (status < 500 && status !== 429) return null;
	return new WebmentionFetchError(`Failed to read ${fetched.url}: it answered ${status}`, true);
}

/** The essence of a content type, lowercased, which is the part a format is decided by. */
export function essenceOf(message: { headers: Headers }): string {
	let declared = message.headers.get("content-type") ?? "";
	return declared.split(";").at(0)?.trim().toLowerCase() ?? "";
}

/** Whether a content type is HTML, the one format links, endpoints and microformats are read from. */
export function isHTML(essence: string): boolean {
	return essence === "text/html" || essence === "application/xhtml+xml";
}
