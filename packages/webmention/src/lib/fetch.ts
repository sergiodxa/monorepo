/**
 * The one way this package fetches a page a stranger named: public hosts only, every
 * redirect re-checked, one deadline for the chain and the body, a byte cap counted off
 * the stream, and each failure labelled with whether a retry can help.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { checkUrl, follow, readText } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

import { WebmentionFetchError } from "../index.js";

/** A megabyte holds any page a mention is written on, and costs little of an isolate's memory. */
export const MAX_BYTES = 1_048_576;

/** Five seconds, since the fetch runs in a background job with retries behind it. */
export const TIMEOUT_MS = 5_000;

/** A page that has moved moves once or twice; five hops is generous. */
export const MAX_REDIRECTS = 5;

/**
 * What every fetch asks for. Mentions are written in HTML, so a server that negotiates
 * answers with the format links, endpoints and microformats are read from.
 */
const ACCEPT = "text/html,application/xhtml+xml";

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

/** The last response of a chain, beside the URL it came from. */
export interface Fetched {
	/** Its body carries the fetch's deadline, so reading it later still runs under it. */
	response: Response;
	/** Where the chain ended, which is what a relative URL in the body resolves against. */
	url: string;
}

/**
 * Whether a URL is somewhere this package sends a request: HTTP(S), no credentials, and
 * a public name rather than an address literal or a name reserved for a private network.
 * A refusal is final, so it is never retryable.
 *
 * @param input - The URL as a stranger wrote it.
 */
export function addressable(input: string | URL): Result<URL, WebmentionFetchError> {
	let checked = checkUrl(input, { literals: "refuse" });
	if (isFailure(checked)) return failure(new WebmentionFetchError(checked.error.message, false));
	return checked;
}

/**
 * Requests a page under the bounds, every redirect hop passing `addressable`, and
 * answers the last response of the chain whatever its status. A timeout or a network
 * failure is retryable; a refused host or an overlong chain is final.
 */
export async function fetchBounded(
	input: URL,
	bounds: Bounds,
): Promise<Result<Fetched, WebmentionFetchError>> {
	let followed = await follow(input, {
		headers: { accept: ACCEPT, "user-agent": bounds.userAgent },
		timeout: bounds.timeoutMs ?? TIMEOUT_MS,
		maxRedirects: bounds.maxRedirects ?? MAX_REDIRECTS,
		literals: "refuse",
	});
	if (isFailure(followed)) {
		return failure(new WebmentionFetchError(followed.error.message, followed.error.retryable));
	}

	return success({ response: followed.data.response, url: followed.data.url.href });
}

/**
 * Reads a body within the byte cap, still under the fetch's deadline. Running out of
 * time or a body that broke off mid-read is retryable; a body over the cap is final.
 */
export async function readBody(
	fetched: Fetched,
	bounds: Bounds,
): Promise<Result<string, WebmentionFetchError>> {
	let read = await readText(fetched.response, { maxBytes: bounds.maxBytes ?? MAX_BYTES });
	if (isFailure(read)) {
		return failure(new WebmentionFetchError(read.error.message, read.error.retryable));
	}
	return success(read.data.text);
}

/**
 * The failure a status stands for when asking again later can change it: a server error,
 * or a `429` asking the client to slow down. Any other status is an answer.
 */
export function transientStatus(fetched: Fetched): WebmentionFetchError | null {
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
