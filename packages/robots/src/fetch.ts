/**
 * Retrieves an origin's robots.txt and turns every result into a decision RFC 9309 defines: a
 * 2xx is parsed, a 4xx is unavailable (allow all) and a 5xx, 429 or network failure unreachable
 * (disallow all). The outcome is plain data, so a caller caches it as JSON for `lifetimeMs`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { DEFAULT_MAX_BYTES } from "./lib/parse.js";
import { truncateAtLine } from "./lib/truncate.js";

import type { Robots } from "./index.js";

import { isAllowed, parse, robotsUrl } from "./index.js";

/** How long the whole retrieval, redirects included, may take. */
const DEFAULT_TIMEOUT_MS = 10_000;

/** RFC 9309 §2.3.1.2 has a crawler follow at least five redirects. */
const DEFAULT_MAX_REDIRECTS = 5;

/** RFC 9309 §2.4 caps how long a fetched file is used at 24 hours. */
const CACHE_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** An unreachable origin is asked again within the hour, so an outage never disallows it for a day. */
const UNREACHABLE_LIFETIME_MS = 60 * 60 * 1000;

/** Statuses that send the client on to their `Location`. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** The one 4xx read as unreachable: the origin asking to be left alone for now. */
const TOO_MANY_REQUESTS = 429;

/** The document an unreachable origin is evaluated as, which still lets `/robots.txt` through. */
const DISALLOW_ALL: Robots.Document = {
	groups: [{ userAgents: ["*"], rules: [{ allow: false, pattern: "/" }] }],
	sitemaps: [],
	records: [],
};

/** Types for robots.txt retrieval. */
export namespace RobotsFetch {
	/** The file was retrieved and parsed. */
	export interface Parsed {
		status: "parsed";
		document: Robots.Document;
		lifetimeMs: number;
	}

	/** The origin answered a 4xx other than 429: every path is allowed (§2.3.1.3). */
	export interface Unavailable {
		status: "unavailable";
		httpStatus: number;
		lifetimeMs: number;
	}

	/**
	 * A 5xx, a 429, another unexpected status, a network failure, a timeout, a redirect chain past
	 * the limit, or a body that failed to read: every path is disallowed (§2.3.1.4).
	 */
	export interface Unreachable {
		status: "unreachable";
		/** The final status, `null` when no response decided it. */
		httpStatus: number | null;
		lifetimeMs: number;
	}

	/** What a retrieval decided. */
	export type Outcome = Parsed | Unavailable | Unreachable;

	/** How the file is retrieved. */
	export interface Options {
		/** The crawler's identification string, sent as `User-Agent`. */
		userAgent: string;
		/** For the whole retrieval, redirects included. @default 10_000 */
		timeoutMs?: number;
		/** Bytes of the body parsed; whole lines within it are read. @default 512_000 */
		maxBytes?: number;
		/** @default 5 */
		maxRedirects?: number;
		signal?: AbortSignal;
	}
}

/**
 * Fetches an origin's robots.txt. Every outcome is a decision, so none is a failure: text that is
 * not a URL, like a server that never answers, is `unreachable`. Redirects are walked by hand so
 * the limit holds, and the rules found at the end apply to the origin that was asked.
 *
 * @param url - Any URL on the origin.
 * @param options - The agent to send and what the retrieval may spend.
 * @returns The parsed document, or which of the two fallbacks applies, with its cache lifetime.
 * @example let outcome = await fetchRobots(article.url, { userAgent: AGENT });
 */
export async function fetchRobots(
	url: string | URL,
	options: RobotsFetch.Options,
): Promise<RobotsFetch.Outcome> {
	let address = robotsUrl(url);
	if (address === null) return unreachable(null);

	let timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	let signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
	let maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

	let response: Response;
	let redirects = 0;

	try {
		for (;;) {
			response = await fetch(address, {
				headers: { "user-agent": options.userAgent, accept: "text/plain" },
				credentials: "omit",
				redirect: "manual",
				signal,
			});

			if (!REDIRECT_STATUSES.has(response.status)) break;

			let location = response.headers.get("location");
			release(response);
			if (location === null || redirects >= maxRedirects) return unreachable(response.status);

			address = new URL(location, address).toString();
			redirects++;
		}
	} catch {
		return unreachable(null);
	}

	let { status } = response;

	if (status >= 400 && status < 500 && status !== TOO_MANY_REQUESTS) {
		release(response);
		return { status: "unavailable", httpStatus: status, lifetimeMs: CACHE_LIFETIME_MS };
	}

	if (status < 200 || status >= 300) {
		release(response);
		return unreachable(status);
	}

	let maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
	let bytes = await readWithin(response, maxBytes);
	if (bytes === null) return unreachable(status);

	let text = new TextDecoder().decode(truncateAtLine(bytes, maxBytes));
	return { status: "parsed", document: parse(text, { maxBytes }), lifetimeMs: CACHE_LIFETIME_MS };
}

/**
 * Whether an agent may fetch a URL under a retrieval's outcome: a parsed document is evaluated,
 * unavailable allows everything and unreachable refuses everything but `/robots.txt` itself.
 *
 * @param outcome - What {@link fetchRobots} decided, fresh or from a cache.
 * @param userAgent - The crawler's identification string.
 * @param url - The URL about to be fetched.
 */
export function isAllowedBy(
	outcome: RobotsFetch.Outcome,
	userAgent: string,
	url: string | URL,
): boolean {
	if (outcome.status === "parsed") return isAllowed(outcome.document, userAgent, url);
	if (outcome.status === "unavailable") return true;
	return isAllowed(DISALLOW_ALL, userAgent, url);
}

/** The outcome for an origin whose rules could not be read. */
function unreachable(httpStatus: number | null): RobotsFetch.Unreachable {
	return { status: "unreachable", httpStatus, lifetimeMs: UNREACHABLE_LIFETIME_MS };
}

/** Lets go of a body left unread; the cancellation runs on its own so a stalled stream costs nothing. */
function release(response: Response): void {
	void response.body?.cancel().catch(() => undefined);
}

/**
 * Reads the body until it passes `maxBytes`, then stops and lets the rest go; the caller cuts
 * what was read at the last line end within the limit.
 *
 * @returns The bytes read, or `null` for a stream that failed partway.
 */
async function readWithin(response: Response, maxBytes: number): Promise<Uint8Array | null> {
	if (response.body === null) return new Uint8Array(0);

	let reader = response.body.getReader();
	let chunks: Uint8Array[] = [];
	let total = 0;

	try {
		while (total <= maxBytes) {
			let { done, value } = await reader.read();
			if (done || value === undefined) break;
			chunks.push(value);
			total += value.byteLength;
		}
	} catch {
		return null;
	}

	if (total > maxBytes) void reader.cancel().catch(() => undefined);

	let bytes = new Uint8Array(total);
	let offset = 0;
	for (let chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}
