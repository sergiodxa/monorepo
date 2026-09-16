/**
 * Bounds the two things an origin decides for a client that asks it for a feed:
 * how far it can send that client before answering, and how much it can make it
 * hold in memory once it does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

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

/** The statuses that answer with another URL to ask instead. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** A response, beside the URL it finally came from. */
export interface Retrieved {
	response: Response;
	url: string;
}

/**
 * Requests a URL, walking the redirect chain itself.
 *
 * Following the chain here is what gives it a length it can exceed, and it
 * keeps the final URL a fact this package tracked rather than one the runtime
 * is trusted to report.
 *
 * @param input - The URL to request
 * @param headers - The headers to send on every hop
 * @param options - The caller's redirect limit and abort signal
 * @returns The response and where it came from, or the reason there is none
 */
export async function retrieve(
	input: string,
	headers: Headers,
	options: Feed.FetchOptions,
): Promise<Result<Retrieved, FeedFetchError>> {
	let limit = options.maxRedirects ?? MAX_REDIRECTS;
	let url = input;

	for (let followed = 0; ; followed++) {
		let response: Response;
		try {
			response = await fetch(url, { headers, signal: options.signal, redirect: "manual" });
		} catch (error) {
			return failure(new FeedFetchError(`Failed to fetch ${input}: ${describe(error)}`));
		}

		let next = redirectTarget(response, url);
		if (!next) return success({ response, url });

		if (response.body) release(response.body);

		if (followed === limit) {
			return failure(new FeedLimitError(`Failed to fetch ${input}: more than ${limit} redirects`));
		}

		url = next;
	}
}

/**
 * Reads a response body as text, stopping as soon as it grows past the cap.
 *
 * The count over the stream is what enforces the rule, so a body that arrives
 * in pieces and a body that lies about its length are refused by the same
 * bytes, before either is held whole.
 *
 * @param retrieved - The response to read and the URL it came from
 * @param options - The caller's size cap
 * @returns The body as text, or the reason it was refused
 */
export async function readWithin(
	retrieved: Retrieved,
	options: Feed.FetchOptions,
): Promise<Result<string, FeedFetchError>> {
	let { response, url } = retrieved;
	let cap = options.maxBytes ?? MAX_BYTES;

	let declared = declaredLength(response);
	if (declared !== undefined && declared > cap) {
		return failure(
			new FeedLimitError(
				`Failed to fetch ${url}: the response declared ${declared} bytes, over the ${cap} byte cap`,
			),
		);
	}

	if (!response.body) return success("");

	let reader = response.body.getReader();
	let decoder = new TextDecoder();
	let text = "";
	let read = 0;

	try {
		for (;;) {
			let { done, value } = await reader.read();
			if (done || !value) break;

			read += value.byteLength;
			if (read > cap) {
				release(reader);
				return failure(
					new FeedLimitError(`Failed to fetch ${url}: the response exceeded the ${cap} byte cap`),
				);
			}

			text += decoder.decode(value, { stream: true });
		}
	} catch (error) {
		return failure(new FeedFetchError(`Failed to fetch ${url}: ${describe(error)}`));
	}

	return success(text + decoder.decode());
}

/**
 * Lets go of a body this retrieval leaves unread, telling the origin it may stop
 * sending. The cancellation runs on its own, so the outcome is reported as soon
 * as it is decided and a stream that stalls costs one refusal and nothing more.
 */
function release(source: { cancel(): Promise<void> }): void {
	void source.cancel().catch(() => undefined);
}

/**
 * Names the URL a response sends the client on to, absent when it is an answer
 * rather than a redirect, or when it names somewhere that is not a URL and so
 * leaves the status itself as the outcome.
 */
function redirectTarget(response: Response, from: string): string | undefined {
	if (!REDIRECT_STATUSES.has(response.status)) return undefined;

	let location = response.headers.get("location");
	if (!location) return undefined;

	try {
		return new URL(location, from).toString();
	} catch {
		return undefined;
	}
}

/** Reads the length a response claims, for the refusal that costs no bytes at all. */
function declaredLength(response: Response): number | undefined {
	let header = response.headers.get("content-length");
	if (!header) return undefined;

	let length = Number(header);
	return Number.isFinite(length) ? length : undefined;
}
