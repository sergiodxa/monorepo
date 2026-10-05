/**
 * Bounds the three things an origin decides for a client that asks it for a feed:
 * where it can send that client, how far before answering, and how much it can make
 * it hold in memory once it does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OutboundError } from "@sdxc/outbound";
import type { Result } from "@sdxc/result";

import { follow, readText } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

import type { Feed } from "../index.js";

import { FeedFetchError, FeedLimitError } from "../index.js";

import { describe } from "./utils.js";

/**
 * How much of a body is read before a response is refused.
 *
 * A feed is text — a few hundred entries carrying their summaries — and the
 * largest real ones run to two or three megabytes. Ten covers every honest
 * publisher and still costs a fraction of the memory one isolate has.
 */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * How many redirects are followed before a chain is refused.
 *
 * A feed that has moved moves once or twice: a scheme upgrade, a new domain, a
 * host's own canonical hop. Five covers those with room to spare, and costs a
 * chain assembled to spend a poller's budget five requests to get nowhere.
 */
const MAX_REDIRECTS = 5;

/** A response, beside the URL it finally came from. */
export interface Retrieved {
	response: Response;
	url: string;
}

/**
 * Requests a URL, walking the redirect chain with every hop checked against the
 * caller's host policy, so a feed URL that passed can only redirect somewhere that
 * would have passed too. The final response is answered whatever its status.
 *
 * @param input - The URL to request
 * @param headers - The headers to send on every hop
 * @param options - The caller's host policy, redirect limit and abort signal
 * @returns The response and where it came from, or the reason there is none
 */
export async function retrieve(
	input: string,
	headers: Headers,
	options: Feed.FetchOptions,
): Promise<Result<Retrieved, FeedFetchError>> {
	let followed = await follow(input, {
		headers,
		hosts: options.hosts ?? "public",
		maxRedirects: options.maxRedirects ?? MAX_REDIRECTS,
		signal: options.signal,
	});
	if (isFailure(followed)) return failure(toFeedError(followed.error));

	return success({ response: followed.data.response, url: followed.data.url.href });
}

/**
 * Reads a response body as text, stopping as soon as it grows past the cap.
 *
 * A declared length over the cap is refused before a byte is read, and the count
 * over the stream refuses a body that arrives in pieces or lies about its length
 * at the same byte, before either is held whole.
 *
 * @param retrieved - The response to read and the URL it came from
 * @param options - The caller's size cap
 * @returns The body as text, or the reason it was refused
 */
export async function readWithin(
	retrieved: Retrieved,
	options: Feed.FetchOptions,
): Promise<Result<string, FeedFetchError>> {
	let cap = options.maxBytes ?? MAX_BYTES;
	let read = await readText(retrieved.response, { maxBytes: cap });
	if (isFailure(read)) return failure(toReadError(read.error, retrieved.url, cap));

	return success(read.data.text);
}

/**
 * Maps a failed walk to this package's errors: a chain past its limit is a
 * `FeedLimitError`, and every refusal, deadline and transport failure is a
 * `FeedFetchError` keeping the outbound message, which names the hop and the rule.
 */
function toFeedError(error: OutboundError): FeedFetchError {
	if (error.code === "too-many-redirects") {
		return new FeedLimitError(error.message, { cause: error });
	}

	return new FeedFetchError(error.message, { cause: error });
}

/**
 * Maps a failed body read to this package's errors, naming the URL the chain ended
 * at, since a body carries no URL of its own: a body past the cap is a
 * `FeedLimitError`, and a stalled or broken one is a `FeedFetchError`.
 */
function toReadError(error: OutboundError, url: string, cap: number): FeedFetchError {
	if (error.code === "too-large") {
		return new FeedLimitError(`Failed to fetch ${url}: the response exceeded the ${cap} byte cap`, {
			cause: error,
		});
	}

	let reason =
		error.code === "timeout" ? "timed out reading the body" : describe(error.cause ?? error);
	return new FeedFetchError(`Failed to fetch ${url}: ${reason}`, { cause: error });
}
