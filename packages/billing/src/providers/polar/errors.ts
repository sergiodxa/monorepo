/**
 * Normalization of a Polar failure into our own: one code a caller branches on,
 * Polar's own code kept beside it, and a message a log line can use. It reads
 * both bodies Polar answers with and treats a lost answer as an unknown outcome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type { BillingErrorCode } from "../../core/errors.js";

import { BillingError } from "../../core/errors.js";

import { DOMAIN_ERROR_SCHEMA, MESSAGE_ERROR_SCHEMA, VALIDATION_ERROR_SCHEMA } from "./schemas.js";

/**
 * How each status Polar answers with is reported. A status outside the table is
 * read as a request problem below 500 and as an unknown outcome at or above it,
 * since a lost answer may still have taken effect.
 */
const STATUS_CODES: Readonly<Record<number, BillingErrorCode>> = {
	400: "invalid_request",
	401: "unauthenticated",
	402: "invalid_request",
	403: "forbidden",
	404: "not_found",
	409: "conflict",
	410: "not_found",
	412: "conflict",
	422: "invalid_request",
	429: "rate_limited",
};

/** The status at which an answer says nothing about whether the call took effect. */
const SERVER_ERROR_STATUS = 500;

/** Header a rate-limited answer states the wait in. */
const RETRY_AFTER_HEADER = "Retry-After";

/** Reads the seconds a rate-limited answer asks the caller to wait for. */
function retryAfterOf(headers: Headers): number | null {
	let stated = headers.get(RETRY_AFTER_HEADER);
	if (stated === null) return null;

	let seconds = Number(stated);

	return Number.isFinite(seconds) ? seconds : null;
}

/** What a failure body says, once whichever shape arrived has been read. */
interface PolarFailure {
	/** Polar's own code, which only a domain failure carries. */
	code: string | null;
	message: string;
	/** Fields a validation failure located, by their own names. */
	fields: string[];
}

/** Reads the field names a validation issue points at, ignoring the body/query prefix. */
function fieldsOf(issues: readonly { loc?: (string | number)[] | undefined }[]): string[] {
	return issues.flatMap((issue) =>
		(issue.loc ?? []).filter((part): part is string => typeof part === "string"),
	);
}

/**
 * Reads a failure body, whichever of Polar's three shapes it is: a coded domain
 * failure, a validation failure listing issues, or a bare message from a URL
 * matching no route.
 *
 * @param body - The response body as text, which may be empty or not JSON at all.
 * @returns Polar's code, a message, and the fields a validation failure named.
 */
function readFailure(body: string): PolarFailure {
	let payload: unknown;

	try {
		payload = JSON.parse(body);
	} catch {
		return { code: null, message: body.slice(0, 200), fields: [] };
	}

	let domain = s.parseSafe(DOMAIN_ERROR_SCHEMA, payload);
	if (domain.success) {
		return {
			code: domain.value.error,
			message: domain.value.detail ?? domain.value.error,
			fields: [],
		};
	}

	let validation = s.parseSafe(VALIDATION_ERROR_SCHEMA, payload);
	if (validation.success) {
		return {
			code: null,
			message: validation.value.detail.map((issue) => issue.msg).join("; "),
			fields: fieldsOf(validation.value.detail),
		};
	}

	let message = s.parseSafe(MESSAGE_ERROR_SCHEMA, payload);
	if (message.success) return { code: null, message: message.value.detail, fields: [] };

	return { code: null, message: body.slice(0, 200), fields: [] };
}

/** What a caller knows about a failing call that the response body does not say. */
export interface PolarErrorOptions {
	/**
	 * Field whose rejection means the value is already taken, so a uniqueness
	 * violation Polar reports as a validation issue is reported as a conflict.
	 */
	conflictOn?: string;
}

/**
 * Turns a failing Polar response into the failure a caller branches on.
 *
 * @param connection - The configured credential set the call was made against.
 * @param response - The answer, for its status and its `Retry-After`.
 * @param body - Response body as text, read once by the caller.
 * @param options - Which field's rejection means a conflict, when the call has one.
 * @returns The failure, carrying Polar's own code and the wait it asked for.
 */
export function toBillingError(
	connection: string,
	response: Response,
	body: string,
	options: PolarErrorOptions = {},
): BillingError {
	let status = response.status;
	let failure = readFailure(body);
	let code =
		STATUS_CODES[status] ?? (status >= SERVER_ERROR_STATUS ? "unknown" : "invalid_request");

	if (
		options.conflictOn !== undefined &&
		code === "invalid_request" &&
		failure.fields.includes(options.conflictOn)
	) {
		code = "conflict";
	}

	let message = failure.message.length > 0 ? failure.message : `Polar answered ${status}`;

	return new BillingError(message, {
		code,
		connection,
		providerCode: failure.code,
		retryAfter: retryAfterOf(response.headers),
	});
}

/**
 * Reports a call whose answer never arrived. The operation may already have
 * taken effect, so recovery is a read-back rather than a retry.
 *
 * @param connection - The configured credential set the call was made against.
 * @param cause - What the transport threw.
 * @returns An `unknown` failure, which is never retryable.
 */
export function toTransportError(connection: string, cause: unknown): BillingError {
	let message = cause instanceof Error ? cause.message : String(cause);

	return new BillingError(`Polar could not be reached: ${message}`, {
		code: "unknown",
		connection,
		cause,
	});
}

/**
 * Reports an answer this provider cannot map: a shape or a platform vocabulary
 * outside what the models describe, which a call site would otherwise read as
 * though it were ours.
 *
 * @param connection - The configured credential set the call was made against.
 * @param message - What could not be mapped, in terms a log line can use.
 * @returns An `invalid_response` failure naming the mapping that is missing.
 */
export function toMappingError(connection: string, message: string): BillingError {
	return new BillingError(message, { code: "invalid_response", connection });
}
