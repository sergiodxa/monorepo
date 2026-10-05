/**
 * Requests a URL and walks its redirect chain by hand, so every hop passes the same
 * check as the first, the chain has a length it can exceed, and one deadline covers
 * the whole chain and the body read after it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { failure, isFailure, success } from "@sdxc/result";

import type { CheckOptions } from "./check.js";

import { checkUrl } from "./check.js";
import { failedWith, OutboundError } from "./error.js";
import { release, withBody } from "./read.js";
import { resolveHost } from "./resolve.js";

/** A moved page moves once or twice; five hops covers that with room to spare. */
const MAX_REDIRECTS = 5;

/** The statuses that answer with another URL to ask instead. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** What a walk sends, and what it may spend; every `checkUrl` option applies to every hop. */
export interface FollowOptions extends CheckOptions {
	/** @default "GET" */
	method?: "GET" | "HEAD";
	/** Sent on every hop, so the origin sees the same request wherever the chain leads. */
	headers?: HeadersInit;
	/** How long the chain and the body read after it may take together. */
	timeout?: DurationInput;
	/** @default 5 */
	maxRedirects?: number;
	/**
	 * Resolves every hop's name over DNS-over-HTTPS and refuses it when any address is
	 * not public. The connection itself is not pinned to those addresses, so this
	 * narrows DNS rebinding and leaves it open to a name that answers differently twice.
	 *
	 * @default false
	 */
	resolve?: boolean;
	/** The caller's own abort, combined with `timeout`. */
	signal?: AbortSignal;
}

/** The last response of a chain, where it came from, and how many hops it took. */
export interface Followed {
	/** Answered whatever its status; its body is bound to the walk's deadline. */
	response: Response;
	/** Where the chain ended, which is what a relative URL in the body resolves against. */
	url: URL;
	redirects: number;
}

/**
 * Requests a URL, following redirects while each one passes the check. Requests carry
 * no credentials and only the headers given, so the origin sees an anonymous visitor.
 * A request with a body belongs to a single checked `fetch` with `redirect: "manual"`.
 *
 * @param input - The URL to request, as a stranger wrote it.
 * @param options - The check every hop passes, the headers, and the bounds.
 * @returns The final response whatever its status, or why there is none.
 * @example let followed = await follow(url, { timeout: "8 seconds", headers: { accept: "text/html" } });
 */
export async function follow(
	input: string | URL,
	options: FollowOptions = {},
): Promise<Result<Followed, OutboundError>> {
	let checked = checkUrl(input, options);
	if (isFailure(checked)) return checked;

	let limit = options.maxRedirects ?? MAX_REDIRECTS;
	let signal = deadlineOf(options);
	let headers = new Headers(options.headers);
	let url = checked.data;

	for (let redirects = 0; ; redirects++) {
		if (options.resolve && options.hosts !== "any") {
			let resolved = await resolveHost(url, signal ? { signal } : {});
			if (isFailure(resolved)) return resolved;
		}

		let response: Response;
		try {
			response = await fetch(url, {
				method: options.method ?? "GET",
				headers,
				signal,
				redirect: "manual",
				credentials: "omit",
			});
		} catch (error) {
			return failure(failedWith(url.href, error));
		}

		let next = redirectTarget(response, url);
		if (next === undefined) {
			return success({ response: bindBody(response, signal), url, redirects });
		}

		release(response.body);

		if (redirects === limit) {
			let first = checked.data.href;
			return failure(
				new OutboundError(
					"too-many-redirects",
					first,
					`Refused ${first}: more than ${limit} redirects`,
				),
			);
		}

		let hop = checkUrl(next, options);
		if (isFailure(hop)) return hop;
		url = hop.data;
	}
}

/** The one signal every hop and the body carry, or none when the caller set no bound. */
function deadlineOf(options: FollowOptions): AbortSignal | undefined {
	let signals: AbortSignal[] = [];
	if (options.timeout !== undefined) signals.push(AbortSignal.timeout(toMs(options.timeout)));
	if (options.signal) signals.push(options.signal);
	return signals.length > 0 ? AbortSignal.any(signals) : undefined;
}

/**
 * Ties a body to the walk's deadline, so a body that is still arriving when it passes
 * errors with the deadline's reason in every runtime and the read fails `timeout`.
 */
function bindBody(response: Response, signal: AbortSignal | undefined): Response {
	if (signal === undefined || response.body === null) return response;
	return withBody(response, response.body.pipeThrough(new TransformStream(), { signal }));
}

/**
 * Names the URL a response sends the client on to, absent when it is an answer rather
 * than a redirect, or when its `Location` is not a URL and so leaves the status itself
 * as the outcome.
 */
function redirectTarget(response: Response, from: URL): string | undefined {
	if (!REDIRECT_STATUSES.has(response.status)) return undefined;

	let location = response.headers.get("location");
	if (location === null || !URL.canParse(location, from)) return undefined;

	return new URL(location, from).href;
}
