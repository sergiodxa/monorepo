/**
 * Normalization of a Buttondown failure into a `NewsletterError`: the status
 * decides the code, Buttondown's own `code` refines a refusal a visitor can act
 * on, and a lost answer is an unknown outcome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type { NewsletterErrorCode } from "../errors.js";

import { NewsletterError } from "../errors.js";

import { CODED_ERROR_SCHEMA, VALIDATION_ERROR_SCHEMA } from "./schemas.js";

/**
 * How each status Buttondown answers with is reported. Any other status is a
 * request problem below 500 and an unknown outcome from 500 up, since a lost
 * answer may still have taken effect.
 */
const STATUS_CODES: Readonly<Record<number, NewsletterErrorCode>> = {
	401: "unauthenticated",
	403: "forbidden",
	404: "not_found",
	429: "rate_limited",
};

/**
 * Buttondown codes that name a refusal more precisely than the status does.
 * They arrive on a `400`, so they are what tells a malformed address and a
 * blocked one apart from any other rejected request.
 */
const PROVIDER_CODES: Readonly<Record<string, NewsletterErrorCode>> = {
	email_invalid: "invalid_address",
	email_empty: "invalid_address",
	email_blocked: "suppressed",
	subscriber_blocked: "suppressed",
	subscriber_suppressed: "suppressed",
	rate_limited: "rate_limited",
};

/** Field a request-validation failure names when the address itself was refused. */
const ADDRESS_FIELD = "email_address";

/** The status from which an answer says nothing about whether the call took effect. */
const SERVER_ERROR_STATUS = 500;

/** Characters of an unreadable body kept in the message, enough to recognize it in a log. */
const BODY_EXCERPT_LENGTH = 200;

/** What a failure body says, once whichever of Buttondown's two shapes arrived is read. */
interface ButtondownFailure {
	code: string | null;
	message: string;
	/** Whether a validation failure located the address field. */
	addressRejected: boolean;
}

/** Reads the seconds a rate-limited answer asks the caller to wait for; an HTTP date reads as none. */
function retryAfterOf(headers: Headers): number | null {
	let stated = headers.get("Retry-After");
	if (stated === null || stated.trim() === "") return null;

	let seconds = Number(stated);

	return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * Reads a failure body: Buttondown's coded `{ code, detail }`, its field-level
 * validation list, or anything else as an excerpt of the text.
 */
function readFailure(body: string): ButtondownFailure {
	let payload: unknown;

	try {
		payload = JSON.parse(body);
	} catch {
		return { code: null, message: body.slice(0, BODY_EXCERPT_LENGTH), addressRejected: false };
	}

	let coded = s.parseSafe(CODED_ERROR_SCHEMA, payload);
	if (coded.success) {
		return { code: coded.value.code ?? null, message: coded.value.detail, addressRejected: false };
	}

	let validation = s.parseSafe(VALIDATION_ERROR_SCHEMA, payload);
	if (validation.success) {
		return {
			code: null,
			message: validation.value.detail.map((issue) => issue.msg).join("; "),
			addressRejected: validation.value.detail.some((issue) => issue.loc.includes(ADDRESS_FIELD)),
		};
	}

	return { code: null, message: body.slice(0, BODY_EXCERPT_LENGTH), addressRejected: false };
}

/**
 * Turns a failing Buttondown response into the failure a caller branches on.
 *
 * @param connection - The configured credential set the call was made against.
 * @param response - The answer, for its status and its `Retry-After`.
 * @param body - Response body as text, read once by the caller.
 * @returns The failure, carrying Buttondown's own code and the wait it asked for.
 */
export function toNewsletterError(
	connection: string,
	response: Response,
	body: string,
): NewsletterError {
	let status = response.status;
	let failure = readFailure(body);

	let code: NewsletterErrorCode =
		STATUS_CODES[status] ?? (status >= SERVER_ERROR_STATUS ? "unknown" : "invalid_request");

	if (code === "invalid_request") {
		let refined = failure.code === null ? undefined : PROVIDER_CODES[failure.code];
		if (refined !== undefined) code = refined;
		else if (failure.addressRejected) code = "invalid_address";
	}

	let message = failure.message.length > 0 ? failure.message : `Buttondown answered ${status}`;

	return new NewsletterError(message, {
		code,
		connection,
		providerCode: failure.code,
		retryAfter: retryAfterOf(response.headers),
	});
}

/**
 * Reports a call whose answer never arrived. The write may already have landed,
 * so recovery is a read-back or a repeat of an idempotent call.
 *
 * @param connection - The configured credential set the call was made against.
 * @param cause - What the transport threw.
 * @returns An `unknown` failure.
 */
export function toTransportError(connection: string, cause: unknown): NewsletterError {
	let message = cause instanceof Error ? cause.message : String(cause);

	return new NewsletterError(`Buttondown could not be reached: ${message}`, {
		code: "unknown",
		connection,
		cause,
	});
}

/**
 * Reports a `2xx` answer this provider cannot express in the models: a shape or
 * a subscriber type outside what the mapping covers.
 *
 * @param connection - The configured credential set the call was made against.
 * @param message - What could not be mapped, in terms a log line can use.
 * @returns An `invalid_response` failure.
 */
export function toMappingError(connection: string, message: string): NewsletterError {
	return new NewsletterError(message, { code: "invalid_response", connection });
}
