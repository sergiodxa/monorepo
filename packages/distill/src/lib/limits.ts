/**
 * Bounds what an arbitrary page may do to the client that asks for it: which hosts
 * are addressable at all, how far a chain may send it, how much body it may hold,
 * and how long it may be kept waiting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OutboundError } from "@sdxc/outbound";
import type { Result } from "@sdxc/result";

import { checkUrl, follow, release } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

import { DistillLimitError, DistillRefusedError } from "../index.js";

/**
 * How much of a body is read before a response is refused. An article page is one
 * document rather than a few hundred entries, so two megabytes covers the heaviest
 * real templates and still costs a fraction of one isolate's memory.
 */
export const MAX_BYTES = 2 * 1024 * 1024;

/**
 * How many redirects are followed before a chain is refused. A page that has moved
 * moves once or twice, and five costs a chain assembled to spend the budget on
 * getting nowhere.
 */
export const MAX_REDIRECTS = 5;

/**
 * How long a retrieval may take. Shorter than a background poll's budget because a
 * reader is sitting in front of this one.
 */
export const TIMEOUT_MS = 8_000;

/** The statuses a publisher says no with, each of which is a refusal rather than a fault. */
const REFUSING_STATUSES = new Set([401, 402, 403, 429, 451]);

/** A response, beside the URL it finally came from. */
export interface Retrieved {
	/** Its body carries the retrieval's deadline, so reading it later still runs under it. */
	response: Response;
	/** Where the chain ended, which is what a relative URL in the body resolves against. */
	url: string;
}

/**
 * Reads a URL as somewhere this package is willing to go, before any request is made:
 * HTTP(S) only, no credentials, and a public name rather than an address literal or a
 * name reserved for a private network.
 *
 * @param input - The address to check, as the page that linked it spelled it.
 * @returns The parsed URL, or the refusal that spares the request.
 */
export function addressable(input: string): Result<URL, DistillRefusedError> {
	let checked = checkUrl(input, { literals: "refuse" });
	if (isFailure(checked)) return failure(new DistillRefusedError(checked.error.message));
	return checked;
}

/** What a retrieval is allowed to spend. */
export interface RetrieveOptions {
	/** What the request names itself as, so a publisher can tell who is asking. */
	userAgent: string;
	maxRedirects?: number | undefined;
	/** Runs alongside `signal`, so a caller's own abort never lifts the deadline. */
	timeoutMs?: number | undefined;
	signal?: AbortSignal | undefined;
}

/**
 * Requests a page and answers only a successful response: every redirect hop passes
 * `addressable`, a status a publisher says no with is a refusal, and any other
 * failing status is a fault. The request carries no credentials and only the headers
 * built here, so a page is fetched as an anonymous visitor every time.
 *
 * @param input - The address to retrieve.
 * @param options - The name to ask under, and what the retrieval may spend.
 * @returns The response and where it came from, or why there is none.
 */
export async function retrieve(
	input: URL,
	options: RetrieveOptions,
): Promise<Result<Retrieved, DistillLimitError | DistillRefusedError>> {
	let followed = await follow(input, {
		headers: { accept: "text/html,application/xhtml+xml", "user-agent": options.userAgent },
		timeout: options.timeoutMs ?? TIMEOUT_MS,
		maxRedirects: options.maxRedirects ?? MAX_REDIRECTS,
		literals: "refuse",
		...(options.signal ? { signal: options.signal } : {}),
	});
	if (isFailure(followed)) return failure(toDistillError(followed.error));

	let { response } = followed.data;
	let url = followed.data.url.href;

	if (REFUSING_STATUSES.has(response.status)) {
		release(response.body);
		return failure(new DistillRefusedError(`Refused ${url}: the site answered ${response.status}`));
	}

	if (!response.ok) {
		release(response.body);
		return failure(
			new DistillLimitError(`Failed to read ${url}: the site answered ${response.status}`),
		);
	}

	return success({ response, url });
}

/**
 * Reads an outbound failure as the outcome a reader is shown: an address this package
 * will not ask for is a refusal, and every bound that ran out, a failed connection
 * included, is a limit.
 *
 * @param error - Why the walk or the read stopped.
 */
export function toDistillError(error: OutboundError): DistillLimitError | DistillRefusedError {
	if (error.code === "invalid-url" || error.code.startsWith("refused-")) {
		return new DistillRefusedError(error.message);
	}
	return new DistillLimitError(error.message);
}
