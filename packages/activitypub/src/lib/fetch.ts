/**
 * The one way this package reads a remote document: through `@sdxc/outbound`, so every
 * hop is checked and resolved to public addresses, within a deadline and a size cap, with
 * the response status mapped to the `ActivityPubFetchError` code a caller branches on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DurationInput } from "@sdxc/duration";
import type { OutboundError } from "@sdxc/outbound";
import type { Result } from "@sdxc/result";

import { follow, readText, release } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

import type { ActivityPubFetchErrorCode } from "../errors.js";

import { ActivityPubFetchError } from "../errors.js";

/** Long enough for a slow instance, short enough that an inbox request still answers. */
export const DEFAULT_TIMEOUT: DurationInput = "10 seconds";

/** An actor with a long bio and many profile fields stays far below a megabyte. */
export const DEFAULT_MAX_BYTES = 1024 * 1024;

/** How a document is requested. */
export interface FetchTextOptions {
	/** Sent on every hop of the redirect chain. */
	headers: Headers;
	timeout: DurationInput;
	maxBytes: number;
}

/** A successful response's body, and the URL the redirect chain ended at. */
export interface FetchedText {
	text: string;
	url: URL;
}

/** The final response of a chain whose status may not be a success, before its body is read. */
export interface Answered {
	response: Response;
	url: URL;
}

/**
 * Requests a URL and answers the final response whatever its status, with every hop's
 * host resolved and refused unless all its addresses are public.
 *
 * @param url - The URL to request.
 * @param options - The headers, deadline and cap.
 */
export async function request(
	url: string,
	options: FetchTextOptions,
): Promise<Result<Answered, ActivityPubFetchError>> {
	let followed = await follow(url, {
		headers: options.headers,
		timeout: options.timeout,
		resolve: true,
	});
	if (isFailure(followed)) return failure(fromOutbound(url, followed.error));
	return success({ response: followed.data.response, url: followed.data.url });
}

/**
 * Reads a successful response's body within the cap, and fails any other status with the
 * code that says what a caller does next: forget the resource on `gone`, sign the request
 * on `unauthorized`, retry on a `5xx` or `429` under `http`.
 *
 * @param url - The URL that was asked for, which the error names.
 * @param answered - The final response and where the chain ended.
 * @param maxBytes - The body cap.
 */
export async function readSuccess(
	url: string,
	answered: Answered,
	maxBytes: number,
): Promise<Result<FetchedText, ActivityPubFetchError>> {
	let { response } = answered;
	if (!response.ok) {
		release(response.body);
		let status = response.status;
		return failure(
			new ActivityPubFetchError(statusCode(status), url, `${url} answered ${status}`, { status }),
		);
	}

	let body = await readText(response, { maxBytes });
	if (isFailure(body)) return failure(fromOutbound(url, body.error, response.status));
	return success({ text: body.data.text, url: answered.url });
}

/**
 * Requests a URL and reads its body when it answers with a success.
 *
 * @param url - The URL to request.
 * @param options - The headers, deadline and cap.
 */
export async function fetchText(
	url: string,
	options: FetchTextOptions,
): Promise<Result<FetchedText, ActivityPubFetchError>> {
	let answered = await request(url, options);
	if (isFailure(answered)) return answered;
	return readSuccess(url, answered.data, options.maxBytes);
}

/**
 * Decodes a body as one JSON object, the only shape an ActivityStreams or JRD document has.
 *
 * @param url - The document's URL, for the error.
 * @param text - The body.
 */
export function decodeObject(
	url: string,
	text: string,
): Result<Record<string, unknown>, ActivityPubFetchError> {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch (cause) {
		return failure(
			new ActivityPubFetchError("invalid-document", url, `${url} is not JSON`, { cause }),
		);
	}
	if (typeof json !== "object" || json === null || Array.isArray(json)) {
		return failure(
			new ActivityPubFetchError("invalid-document", url, `${url} is not a JSON object`),
		);
	}
	return success(json as Record<string, unknown>);
}

/** The code a non-success status maps to. */
function statusCode(status: number): ActivityPubFetchErrorCode {
	if (status === 410) return "gone";
	if (status === 404) return "not-found";
	if (status === 401 || status === 403) return "unauthorized";
	return "http";
}

/**
 * Maps an outbound refusal or transport failure to the fetch error, keeping the status
 * when a response had already arrived.
 *
 * @param url - The URL that was asked for.
 * @param error - What `@sdxc/outbound` answered.
 * @param status - The response status, when the failure came while reading its body.
 */
function fromOutbound(url: string, error: OutboundError, status?: number): ActivityPubFetchError {
	let code: ActivityPubFetchErrorCode =
		error.code === "too-large" || error.code === "timeout" || error.code === "network"
			? error.code
			: "refused-url";
	return new ActivityPubFetchError(code, url, error.message, {
		status: status ?? null,
		cause: error,
	});
}
