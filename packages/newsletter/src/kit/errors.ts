/**
 * Normalization of a Kit failure into a `NewsletterError`: the status decides
 * the code, Kit's `errors` array becomes the message, and a lost answer is an
 * unknown outcome, since Kit names no error codes of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type { NewsletterErrorCode } from "../errors.js";

import { NewsletterError } from "../errors.js";

import { ERROR_SCHEMA } from "./schemas.js";

/**
 * How each status Kit answers with is reported. `422` covers a malformed
 * address too, since Kit's body for it carries no code to tell it apart; `413`
 * is Kit refusing more queued work, which waiting resolves like a `429`.
 */
const STATUS_CODES: Readonly<Record<number, NewsletterErrorCode>> = {
	401: "unauthenticated",
	403: "forbidden",
	404: "not_found",
	413: "rate_limited",
	422: "invalid_request",
	429: "rate_limited",
};

/** The status at which an answer says nothing about whether the call took effect. */
const SERVER_ERROR_STATUS = 500;

/** Characters of an unreadable body a message keeps. */
const BODY_EXCERPT = 200;

/** Reads the seconds a rate-limited answer asks the caller to wait for. */
function retryAfterOf(headers: Headers): number | null {
	let stated = headers.get("Retry-After");
	if (stated === null) return null;

	let seconds = Number(stated);

	return Number.isFinite(seconds) ? seconds : null;
}

/** Reads Kit's `errors` array, falling back to the start of a body in any other shape. */
function messageOf(body: string): string {
	let payload: unknown;

	try {
		payload = JSON.parse(body);
	} catch {
		return body.slice(0, BODY_EXCERPT);
	}

	let parsed = s.parseSafe(ERROR_SCHEMA, payload);

	return parsed.success ? parsed.value.errors.join("; ") : body.slice(0, BODY_EXCERPT);
}

/**
 * Turns a failing Kit response into the failure a caller branches on.
 *
 * @param connection - The configured credential set the call was made against.
 * @param response - The answer, for its status and its `Retry-After`.
 * @param body - Response body as text, read once by the caller.
 * @returns The failure, carrying the wait Kit asked for.
 */
export function toNewsletterError(
	connection: string,
	response: Response,
	body: string,
): NewsletterError {
	let status = response.status;
	let code =
		STATUS_CODES[status] ?? (status >= SERVER_ERROR_STATUS ? "unknown" : "invalid_request");
	let message = messageOf(body);

	return new NewsletterError(message.length > 0 ? message : `Kit answered ${status}`, {
		code,
		connection,
		retryAfter: retryAfterOf(response.headers),
	});
}

/**
 * Reports a call whose answer never arrived. The write may already have
 * landed, so recovery is a read-back or a repeat of an idempotent call.
 *
 * @param connection - The configured credential set the call was made against.
 * @param cause - What the transport threw.
 * @returns An `unknown` failure.
 */
export function toTransportError(connection: string, cause: unknown): NewsletterError {
	let message = cause instanceof Error ? cause.message : String(cause);

	return new NewsletterError(`Kit could not be reached: ${message}`, {
		code: "unknown",
		connection,
		cause,
	});
}

/**
 * Reports a `2xx` answer this provider cannot map: a shape or a state outside
 * what the models describe.
 *
 * @param connection - The configured credential set the call was made against.
 * @param message - What could not be mapped, in terms a log line can use.
 * @returns An `invalid_response` failure.
 */
export function toMappingError(connection: string, message: string): NewsletterError {
	return new NewsletterError(message, { code: "invalid_response", connection });
}
