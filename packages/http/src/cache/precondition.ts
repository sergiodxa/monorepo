/**
 * `If-Match` preconditions for writes: the check that a client is updating the
 * version of a resource it actually read. The outcome is a `Result`, so turning a
 * failed precondition into a `412` stays the caller's decision.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";
import { IfMatch } from "remix/headers";

/**
 * The current validator a write is checked against.
 */
export interface PreconditionOptions {
	/**
	 * The resource's current entity tag, as `etag()` produces it. A weak tag never
	 * satisfies an `If-Match`, because equivalent content is not the same version.
	 */
	etag: string;
}

/**
 * The client's `If-Match` did not name the version the resource is currently at,
 * which means the write would overwrite a change the client never saw.
 *
 * Delivered inside a `Failure` for the caller to inspect and answer with a `412`.
 *
 * @example
 * if (isFailure(result)) return preconditionFailed({ error: result.error.message });
 */
export class PreconditionFailedError extends Error {
	/** The validator the resource is actually at, for logs and diagnostics. */
	readonly etag: string;

	/**
	 * @param etag - The resource's current entity tag.
	 */
	constructor(etag: string) {
		super(`Precondition failed: resource is at ${etag}`);
		this.name = "PreconditionFailedError";
		this.etag = etag;
	}
}

/**
 * Checks a write request's `If-Match` against the resource's current validator.
 *
 * An absent `If-Match` or a `*` always matches; every other value is compared
 * strongly, so a weak tag never satisfies it, binding writes to a version read.
 *
 * @param request - The incoming write request.
 * @param options - The resource's current entity tag.
 * @returns The satisfied validator, or a `PreconditionFailedError` to answer with a `412`.
 *
 * @example
 * let checked = precondition(request, { etag: current });
 * if (isFailure(checked)) return preconditionFailed("<h1>Precondition Failed</h1>");
 * @example
 * precondition(request, { etag: '"abc"' }); // success('"abc"') when If-Match is absent
 */
export function precondition(
	request: Request,
	options: PreconditionOptions,
): Result<string, PreconditionFailedError> {
	let ifMatch = IfMatch.from(request.headers.get("If-Match"));

	if (!ifMatch.matches(options.etag)) return failure(new PreconditionFailedError(options.etag));

	return success(options.etag);
}
