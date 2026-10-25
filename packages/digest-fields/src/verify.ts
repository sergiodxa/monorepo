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

import { decodeContent } from "./decode.js";
import { digest, isDigestAlgorithm } from "./digest.js";
import { DigestError } from "./errors.js";
import { parse } from "./parse.js";

/** What `verify` needs besides the headers and the body. */
export interface VerifyOptions {
	/** The field to check, lowercase: `content-digest`, `repr-digest`, `unencoded-digest` or `digest`. */
	field: DigestValueField;
	/**
	 * Whether the body is still coded as `Content-Encoding` says, for `unencoded-digest`:
	 * `verify` then decodes it before hashing. Leave it off for a body already decoded,
	 * as `fetch` hands a response's.
	 * @default false
	 */
	decode?: boolean;
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
 *   `unsupported-algorithm` (no `sha-256` or `sha-512` entry), `mismatch`, `coding` (the
 *   body does not decode) or `crypto`.
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

	let content = await hashedContent(headers, body, options);
	if (isFailure(content)) return content;

	let checked = 0;
	for (let [algorithm, expected] of Object.entries(parsed.data)) {
		if (!isDigestAlgorithm(algorithm)) continue;

		let actual = await digest(content.data, algorithm);
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

/**
 * The bytes a field's digests cover: the body as received, or for `unencoded-digest` with
 * `decode` set, the body with every listed content coding removed.
 *
 * @param headers - The message headers holding `Content-Encoding`.
 * @param body - The body as received.
 * @param options - Which field to check and whether to decode.
 */
async function hashedContent(
	headers: Headers,
	body: BinaryLike,
	options: VerifyOptions,
): Promise<Result<BinaryLike, DigestError>> {
	if (options.field !== "unencoded-digest" || !options.decode) return success(body);
	return decodeContent(body, headers.get("content-encoding"));
}
