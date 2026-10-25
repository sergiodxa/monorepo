/**
 * RFC 8935 push delivery of Security Event Tokens: the transmitter's POST and how it reads
 * the answer, and the recipient's verification, middleware and responses, so both sides
 * speak the `202` / `400 {err, description}` contract the RFC defines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityEventToken } from "@sdxc/jwt";
import type { Result } from "@sdxc/result";
import type { Middleware } from "remix/router";

import { failure, isFailure, success } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createContextKey } from "remix/router";

import type { SecurityEvents } from "../../security-events.js";

import { KeysUnavailableError, SecurityEventError, TransmissionError } from "./errors.js";
import { SET_MEDIA_TYPE, verifySet } from "./verify.js";

/** The language every description this package writes is in, per RFC 2277's default. */
export const DESCRIPTION_LANGUAGE = "en";

/** The `400` body RFC 8935 §2.3 defines; `description` is diagnostic only. */
const ERROR_BODY = s.object({ err: s.string(), description: s.defaulted(s.string(), "") });

/**
 * The verified SET a recipient route reads, for code that reads it by key rather than
 * through `ctx.securityEvent`. The type is written out because an exported key needs a
 * nameable type to reach a published declaration file.
 */
export const SecurityEventKey: { defaultValue?: SecurityEventToken } =
	createContextKey<SecurityEventToken>();

/** Installs the verified SET as `ctx.securityEvent` besides the key. */
const SECURITY_EVENT_PROPERTY = { property: "securityEvent" } as const;

/**
 * POSTs one SET to a recipient's endpoint as RFC 8935 §2.1 requires. A `202` is delivery;
 * a `400` carrying `{err, description}` is the recipient refusing the SET; anything else,
 * or no response, reached no verdict and may be retried.
 *
 * @param endpoint - The recipient's push endpoint
 * @param set - The signed SET, exactly as it should arrive
 * @param options - Extra headers, such as `Authorization`, and an abort signal
 * @returns Nothing on delivery, the recipient's refusal, or why no verdict was reached
 * @example
 * let result = await transmitSet("https://notify.rp.example.com/Events", set, { headers: { Authorization: `Bearer ${token}` } });
 * if (isFailure(result) && result.error instanceof TransmissionError) await retryLater();
 */
export async function transmitSet(
	endpoint: string | URL,
	set: string,
	options: SecurityEvents.TransmitOptions = {},
): Promise<Result<void, SecurityEventError | TransmissionError>> {
	let headers = new Headers(options.headers);
	headers.set("Content-Type", SET_MEDIA_TYPE);
	headers.set("Accept", "application/json");

	let response: Response;
	try {
		response = await fetch(endpoint, {
			method: "POST",
			headers,
			body: set,
			...(options.signal === undefined ? {} : { signal: options.signal }),
		});
	} catch (error) {
		return failure(new TransmissionError("The SET could not be sent", null, error));
	}

	if (response.status === 202) {
		await response.body?.cancel();
		return success(undefined);
	}
	if (response.status !== 400) {
		await response.body?.cancel();
		return failure(
			new TransmissionError(`The recipient answered ${response.status}`, response.status),
		);
	}

	let body = await validate(await readJson(response), ERROR_BODY);
	if (isFailure(body)) {
		return failure(
			new TransmissionError("The recipient answered 400 with no error code", 400, body.error),
		);
	}
	return failure(new SecurityEventError(body.data.err, body.data.description));
}

/**
 * Reads and verifies the SET an RFC 8935 push carries. A body of another media type, or
 * one that is not a SET, fails with `invalid_request`; the rest follows {@link verifySet}.
 *
 * @param request - The transmitter's POST, its body unread
 * @param options - Known issuers and their keys, the expected audience, the token class
 * @returns The verified SET, the error to answer, or `KeysUnavailableError`
 */
export async function verifySetRequest<T extends SecurityEventToken = SecurityEventToken>(
	request: Request,
	options: SecurityEvents.VerifyOptions<T>,
): Promise<Result<T, SecurityEventError | KeysUnavailableError>> {
	let essence = (request.headers.get("Content-Type") ?? "").split(";")[0]?.trim().toLowerCase();
	if (essence !== SET_MEDIA_TYPE) {
		return failure(new SecurityEventError("invalid_request", `The body must be ${SET_MEDIA_TYPE}`));
	}

	let body: string;
	try {
		body = (await request.text()).trim();
	} catch {
		return failure(new SecurityEventError("invalid_request", "The body could not be read"));
	}

	return verifySet(body, options);
}

/**
 * Middleware for an RFC 8935 push endpoint. It verifies the SET and publishes it as
 * `ctx.securityEvent` for the handler, which persists it and answers `setAccepted()`; a SET
 * that fails is answered `400` with its error, and unreadable issuer keys `503`.
 *
 * @param options - Known issuers and their keys, the expected audience, the token class
 * @returns The middleware
 * @example
 * router.post(routes.events, {
 * 	middleware: [setReceiver({ issuers: { "https://idp.example.com/": jwks }, audience: "https://rp.example.com/" })],
 * 	async handler(ctx) {
 * 		await inbox.save(ctx.securityEvent);
 * 		return setAccepted();
 * 	},
 * });
 */
export function setReceiver<T extends SecurityEventToken = SecurityEventToken>(
	options: SecurityEvents.VerifyOptions<T>,
): Middleware<{ key: typeof SecurityEventKey; value: T; property: "securityEvent" }> {
	return async (ctx, next) => {
		let result = await verifySetRequest(ctx.request, options);
		if (!isFailure(result)) {
			ctx.set(SecurityEventKey, result.data, SECURITY_EVENT_PROPERTY);
			return next();
		}
		if (result.error instanceof KeysUnavailableError) {
			return new Response(null, { status: 503, headers: { "Retry-After": "60" } });
		}
		return setRejected(result.error);
	};
}

/**
 * The RFC 8935 §2.2 answer to a SET the recipient validated and persisted.
 *
 * @returns An empty `202 Accepted`
 */
export function setAccepted(): Response {
	return new Response(null, { status: 202 });
}

/**
 * The RFC 8935 §2.3 answer to a SET the recipient refuses, for a handler applying rules of
 * its own, such as `access_denied` for an issuer this transmitter may not send for.
 *
 * @param error - The error code and description
 * @returns A `400` JSON body with `Content-Language`
 */
export function setRejected(error: SecurityEventError): Response {
	return Response.json(error.toJSON(), {
		status: 400,
		headers: { "Content-Language": DESCRIPTION_LANGUAGE },
	});
}

/**
 * A response body as JSON, with an unparseable body read as `null` so schema validation
 * reports it alongside every other malformed answer.
 *
 * @param response - The response, its body unread
 */
export async function readJson(response: Response): Promise<Record<string, unknown> | null> {
	try {
		return (await response.json()) as Record<string, unknown>;
	} catch {
		return null;
	}
}
