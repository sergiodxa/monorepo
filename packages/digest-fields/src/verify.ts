/**
 * Checks a body against the digest field a sender attached, the step that ties a signed
 * header to the bytes it describes: an HTTP signature covers the field, and this proves
 * the field matches the content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BinaryLike } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { timingSafeEqual } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import type { DigestValueField } from "./types.js";

import { digest, isDigestAlgorithm } from "./digest.js";
import { DigestError } from "./errors.js";
import { parse } from "./parse.js";

/** What `verify` needs besides the headers and the body. */
export interface VerifyOptions {
	/** The field to check, lowercase: `content-digest`, `repr-digest` or legacy `digest`. */
	field: DigestValueField;
}

/**
 * Verifies a body against a digest field. Every `sha-256` and `sha-512` entry the field
 * carries must match, so one forged entry next to a valid one still fails; entries for
 * other algorithms are skipped.
 *
 * @param headers - The message headers holding the field.
 * @param body - The exact bytes received; text is read as UTF-8.
 * @param options - Which field to check.
 * @returns Success when every supported entry matches, else `missing`, `malformed`,
 *   `unsupported-algorithm` (no `sha-256` or `sha-512` entry), `mismatch` or `crypto`.
 * @example await verify(request.headers, body, { field: "content-digest" })
 */
export async function verify(
	headers: Headers,
	body: BinaryLike,
	options: VerifyOptions,
): Promise<Result<void, DigestError>> {
	let text = headers.get(options.field);
	if (text === null) return failure(new DigestError("missing", `Missing ${options.field}`));

	let parsed = parse(text, options.field);
	if (isFailure(parsed)) return parsed;

	let checked = 0;
	for (let [algorithm, expected] of Object.entries(parsed.data)) {
		if (!isDigestAlgorithm(algorithm)) continue;

		let actual = await digest(body, algorithm);
		if (isFailure(actual)) return actual;
		if (!timingSafeEqual(actual.data, expected)) {
			return failure(
				new DigestError("mismatch", `The body does not match its ${options.field} ${algorithm}`),
			);
		}
		checked++;
	}

	if (checked === 0) {
		return failure(
			new DigestError("unsupported-algorithm", `${options.field} carries no sha-256 or sha-512`),
		);
	}
	return success(undefined);
}
