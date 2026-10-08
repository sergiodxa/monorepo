/**
 * Makes one RDAP request chain through `@sdxc/outbound`, so every redirect hop is
 * checked against the public-host rules, and turns the outcome into JSON or the
 * `RDAPError` its status, transport failure or body earns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OutboundError } from "@sdxc/outbound";
import type { Result } from "@sdxc/result";

import { follow, readText, release } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

import { RDAPError } from "./error.js";

/** Aggregators and registries redirect once to the authoritative server; three covers a chain of them. */
const MAX_REDIRECTS = 3;

/** What every request sends and may spend. */
export interface RequestOptions {
	accept: string;
	userAgent: string;
	timeoutMs: number;
	maxBytes: number;
}

/** A parsed body and the URL that answered it, after redirects. */
export interface Answered {
	json: unknown;
	url: string;
}

/**
 * Requests a URL and parses its body as JSON. The request is made once: a `429` or a
 * `5xx` comes back as a retryable failure for the caller to schedule.
 *
 * @param url - The URL to request.
 * @param options - Headers, deadline and body cap.
 * @returns The parsed body and where it came from, or why there is none.
 */
export async function requestJSON(
	url: URL,
	options: RequestOptions,
): Promise<Result<Answered, RDAPError>> {
	let followed = await follow(url, {
		headers: { accept: options.accept, "user-agent": options.userAgent },
		timeout: options.timeoutMs,
		maxRedirects: MAX_REDIRECTS,
	});
	if (isFailure(followed)) return failure(fromOutbound(followed.error));

	let { response } = followed.data;
	let answeredUrl = followed.data.url.href;

	if (response.status < 200 || response.status >= 300) {
		release(response.body);
		return failure(fromStatus(response, answeredUrl));
	}

	let body = await readText(response, { maxBytes: options.maxBytes });
	if (isFailure(body)) return failure(fromOutbound(body.error, answeredUrl));

	try {
		return success({ json: JSON.parse(body.data.text) as unknown, url: answeredUrl });
	} catch (error) {
		return failure(
			new RDAPError(
				"invalid-response",
				`${answeredUrl} answered a body that is not JSON`,
				{
					url: answeredUrl,
				},
				{ cause: error },
			),
		);
	}
}

/**
 * Maps a non-2xx answer: `404` means the registry holds no such name, `429` and `5xx`
 * are the server pushing back, and every other status is a refusal.
 */
function fromStatus(response: Response, url: string): RDAPError {
	let status = response.status;

	if (status === 404) {
		return new RDAPError("not-found", `${url} answered 404: no such domain`, { url, status });
	}

	if (status === 429) {
		let retryAfter = retryAfterMs(response.headers.get("retry-after"));
		return new RDAPError("rate-limited", `${url} answered 429: rate limited`, {
			url,
			status,
			...(retryAfter === undefined ? {} : { retryAfter }),
		});
	}

	if (status >= 500) {
		return new RDAPError("server-error", `${url} answered ${status}`, { url, status });
	}

	return new RDAPError("refused", `${url} answered ${status}`, { url, status });
}

/**
 * Maps an `@sdxc/outbound` failure onto the lookup's codes: a refused hop or a chain
 * past its redirect limit is `refused`, and the cap, the deadline and the transport
 * keep their own codes.
 */
function fromOutbound(error: OutboundError, fallbackUrl?: string): RDAPError {
	let url = error.url === "" ? fallbackUrl : error.url;
	let details = url === undefined ? {} : { url };

	switch (error.code) {
		case "too-large":
		case "timeout":
		case "network":
			return new RDAPError(error.code, error.message, details, { cause: error });
		default:
			return new RDAPError("refused", error.message, details, { cause: error });
	}
}

/**
 * Reads `Retry-After` as milliseconds from now: delay-seconds or an HTTP date, a date
 * already past counting as zero. A header in neither form is ignored.
 *
 * @param header - The header's value, or `null` when the response carried none.
 * @returns Milliseconds to wait, or `undefined` when the server did not say.
 */
export function retryAfterMs(header: string | null): number | undefined {
	if (header === null) return undefined;

	let value = header.trim();
	if (/^\d+$/.test(value)) return Number(value) * 1000;

	let date = /[a-z]/i.test(value) ? Date.parse(value) : Number.NaN;
	if (Number.isNaN(date)) return undefined;
	return Math.max(0, date - Date.now());
}
