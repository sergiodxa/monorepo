/**
 * Sends one form POST to a hub and reads its answer against the statuses the caller counts as
 * acceptance. Every way a hub request can fail, from a dropped connection to a refusal, comes
 * back as one error carrying the status when there was one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { WebSubRequestError } from "../index.js";

/** How long a hub has to answer before the request is abandoned. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** The media type WebSub defines every hub request body in. */
export const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

/**
 * Builds the POST a hub reads: the fields form-encoded in the order given, a repeated name
 * written once per value.
 *
 * @param hub - The hub's absolute URL, already validated.
 * @param fields - The `hub.*` fields as name and value pairs.
 */
export function formRequest(hub: URL, fields: readonly [string, string][]): Request {
	return new Request(hub, {
		method: "POST",
		headers: { "content-type": FORM_CONTENT_TYPE },
		body: new URLSearchParams(fields as [string, string][]).toString(),
	});
}

/**
 * Sends a request and succeeds when the status passes `accepted`. The body is discarded either
 * way, since no hub answer carries anything a subscriber or publisher acts on.
 *
 * @param request - The request to send.
 * @param accepted - Whether a status counts as the hub accepting the request.
 * @param timeoutMs - How long the hub has to answer.
 */
export async function send(
	request: Request,
	accepted: (status: number) => boolean,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Result<void, WebSubRequestError>> {
	let response: Response;

	try {
		response = await fetch(request, { signal: AbortSignal.timeout(timeoutMs) });
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return failure(new WebSubRequestError(`Hub ${request.url} did not answer: ${reason}`));
	}

	void response.body?.cancel().catch(() => undefined);

	if (accepted(response.status)) return success(undefined);

	return failure(
		new WebSubRequestError(
			`Hub ${request.url} refused the request with status ${response.status}`,
			response.status,
		),
	);
}

/**
 * Parses an address a hub request needs to be absolute, refusing anything else before a request
 * is built from it.
 *
 * @param value - The address as the caller passed it.
 * @param role - What the address is for, named in the error.
 */
export function absoluteUrl(value: string, role: string): Result<URL, WebSubRequestError> {
	let refusal = new WebSubRequestError(
		`The ${role} ${JSON.stringify(value)} is not an absolute http(s) URL`,
	);

	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return failure(refusal);
	}

	if (url.protocol !== "https:" && url.protocol !== "http:") return failure(refusal);
	return success(url);
}
