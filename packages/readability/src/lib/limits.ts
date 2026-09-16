/**
 * Bounds what an arbitrary page may do to the client that asks for it: which hosts
 * are addressable at all, how far a chain may send it, how much body it may hold,
 * and how long it may be kept waiting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { ReadabilityLimitError, ReadabilityRefusedError } from "../index.js";

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

/** The statuses that answer with another URL to ask instead. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** The statuses a publisher says no with, each of which is a refusal rather than a fault. */
const REFUSING_STATUSES = new Set([401, 402, 403, 429, 451]);

/** Hostnames naming the machine doing the asking, which no article is ever served from. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** A response, beside the URL it finally came from. */
export interface Retrieved {
	response: Response;
	/** Where the chain ended, which is what a relative URL in the body resolves against. */
	url: string;
}

/**
 * Whether a host may be asked at all: a name the public DNS answers for, rather than
 * a literal address, the loopback name or a `.local` name. A Worker at the edge sits
 * inside nobody's private network, and the class of request is worth removing rather
 * than reasoning about.
 *
 * @param hostname - The host as the URL spells it.
 */
export function isAddressableHost(hostname: string): boolean {
	let host = hostname.toLowerCase();

	if (LOOPBACK_HOSTS.has(host)) return false;
	if (host.endsWith(".local") || host.endsWith(".localhost")) return false;
	if (host.startsWith("[")) return false;
	if (/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host)) return false;

	return host.includes(".");
}

/**
 * Reads a URL as somewhere this package is willing to go, refusing a scheme other
 * than HTTP(S) and a host naming the asker's own network before any request is made.
 *
 * @param input - The address to check, as the page that linked it spelled it.
 * @returns The parsed URL, or the refusal that spares the request.
 */
export function addressable(input: string): Result<URL, ReadabilityRefusedError> {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		return failure(new ReadabilityRefusedError(`Refused ${input}: it is not a URL`));
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return failure(new ReadabilityRefusedError(`Refused ${input}: only HTTP(S) is fetched`));
	}

	if (!isAddressableHost(url.hostname)) {
		return failure(new ReadabilityRefusedError(`Refused ${input}: ${url.hostname} is not public`));
	}

	return success(url);
}

/** What a retrieval is allowed to spend. */
export interface RetrieveOptions {
	/** What the request names itself as, so a publisher can tell who is asking. */
	userAgent: string;
	maxRedirects?: number | undefined;
	timeoutMs?: number | undefined;
	signal?: AbortSignal | undefined;
}

/**
 * Requests a page, walking the redirect chain itself so the chain has a length it
 * can exceed and the final URL is a fact this package tracked.
 *
 * The request carries nothing about whoever asked for it: the headers are built
 * here rather than inherited, and credentials are left out, so a page is fetched as
 * an anonymous visitor every time.
 *
 * @param input - The address to retrieve.
 * @param options - The name to ask under, and what the retrieval may spend.
 * @returns The response and where it came from, or why there is none.
 */
export async function retrieve(
	input: URL,
	options: RetrieveOptions,
): Promise<Result<Retrieved, ReadabilityLimitError | ReadabilityRefusedError>> {
	let limit = options.maxRedirects ?? MAX_REDIRECTS;
	let signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS);

	let headers = new Headers({
		accept: "text/html,application/xhtml+xml",
		"user-agent": options.userAgent,
	});

	let url = input;

	for (let followed = 0; ; followed++) {
		let response: Response;
		try {
			response = await fetch(url, {
				headers,
				signal,
				redirect: "manual",
				credentials: "omit",
			});
		} catch (error) {
			return failure(new ReadabilityLimitError(`Failed to read ${url.href}: ${describe(error)}`));
		}

		if (REFUSING_STATUSES.has(response.status)) {
			release(response.body);
			return failure(
				new ReadabilityRefusedError(`Refused ${url.href}: the site answered ${response.status}`),
			);
		}

		let next = redirectTarget(response, url);
		if (!next) {
			if (!response.ok) {
				release(response.body);
				return failure(
					new ReadabilityLimitError(
						`Failed to read ${url.href}: the site answered ${response.status}`,
					),
				);
			}

			return success({ response, url: url.href });
		}

		release(response.body);

		if (followed === limit) {
			return failure(
				new ReadabilityLimitError(`Failed to read ${input.href}: more than ${limit} redirects`),
			);
		}

		let checked = addressable(next);
		if (isFailure(checked)) return checked;
		url = checked.data;
	}
}

/** A body read within its cap, and how many bytes came off the wire to produce it. */
export interface Read {
	text: string;
	bytes: number;
}

/**
 * Reads a response body as text, stopping as soon as it grows past the cap.
 *
 * Counting over the stream is what enforces the rule, so a body arriving in pieces
 * and a body lying about its length are refused by the same bytes, before either is
 * held whole.
 *
 * @param retrieved - The response to read and the URL it came from.
 * @param cap - How many bytes the body may be.
 * @returns The body and its size, or why it was refused.
 */
export async function readWithin(
	retrieved: Retrieved,
	cap: number = MAX_BYTES,
): Promise<Result<Read, ReadabilityLimitError>> {
	let { response, url } = retrieved;

	let declared = declaredLength(response);
	if (declared !== undefined && declared > cap) {
		release(response.body);
		return failure(
			new ReadabilityLimitError(`Refused ${url}: it declared ${declared} bytes, over the cap`),
		);
	}

	if (!response.body) return success({ text: "", bytes: 0 });

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
					new ReadabilityLimitError(`Refused ${url}: it exceeded the ${cap} byte cap`),
				);
			}

			text += decoder.decode(value, { stream: true });
		}
	} catch (error) {
		return failure(new ReadabilityLimitError(`Failed to read ${url}: ${describe(error)}`));
	}

	return success({ text: text + decoder.decode(), bytes: read });
}

/**
 * Whether a response asks not to be kept, which `X-Robots-Tag: noarchive` is the
 * exact name for. A page carrying it is read for whoever asked and held for nobody.
 *
 * @param response - The response the article was read out of.
 */
export function mayArchive(response: Response): boolean {
	let tag = response.headers.get("x-robots-tag");
	if (!tag) return true;
	return !tag
		.toLowerCase()
		.split(",")
		.some((directive) => directive.trim().split(":").at(-1)?.trim() === "noarchive");
}

/**
 * Lets go of a body this retrieval leaves unread, telling the origin it may stop
 * sending. The cancellation runs on its own, so the outcome is reported as soon as
 * it is decided and a stream that stalls costs one refusal and nothing more.
 */
function release(source: { cancel(): Promise<void> } | null): void {
	void source?.cancel().catch(() => undefined);
}

/**
 * Names the URL a response sends the client on to, absent when it is an answer
 * rather than a redirect, or when it names somewhere that is not a URL and so
 * leaves the status itself as the outcome.
 */
function redirectTarget(response: Response, from: URL): string | undefined {
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

/** Reads a thrown value's message, so a rejection reports what went wrong either way. */
function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
