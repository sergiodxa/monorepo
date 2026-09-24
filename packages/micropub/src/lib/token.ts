/**
 * Finds the access token of a Micropub request in the two places RFC 6750 and the
 * specification allow, the `Authorization: Bearer` header and a form's `access_token`,
 * and rejects a request that uses both, as micropub.rocks test 805 requires.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { MicropubRequestError } from "./errors.js";

/** RFC 6750's `b64token` after the `Bearer` scheme, which is matched case-insensitively. */
const BEARER = /^Bearer(?:\s+([A-Za-z0-9\-._~+/]+=*))?\s*$/i;

/**
 * The token of the `Authorization` header. Another scheme is left for other handlers
 * and reads as `null`; a `Bearer` header without a well-formed token is malformed.
 */
export function headerToken(request: Request): Result<string | null, MicropubRequestError> {
	let header = request.headers.get("Authorization");
	if (header === null || !/^Bearer(\s|$)/i.test(header)) return success(null);
	let token = BEARER.exec(header.trim())?.[1];
	if (token === undefined) {
		return failure(new MicropubRequestError("The Authorization header carries no Bearer token."));
	}
	return success(token);
}

/**
 * The single token of the request, from the header or the form's `access_token`. An empty
 * `access_token` reads as absent; more than one, or one in each place, is `invalid_request`.
 */
export function requestToken(
	request: Request,
	formData: FormData | null,
): Result<string | null, MicropubRequestError> {
	let header = headerToken(request);
	if (isFailure(header)) return header;
	let values = formData?.getAll("access_token") ?? [];
	if (values.length > 1) {
		return failure(new MicropubRequestError("The body carries more than one access_token."));
	}
	let [value] = values;
	if (value !== undefined && typeof value !== "string") {
		return failure(new MicropubRequestError("The access_token part must be text."));
	}
	let body = value === undefined || value === "" ? null : value;
	if (header.data !== null && body !== null) {
		return failure(
			new MicropubRequestError(
				"The access token was sent both in the Authorization header and in the body.",
			),
		);
	}
	return success(header.data ?? body);
}
