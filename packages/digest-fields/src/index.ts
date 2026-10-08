/**
 * Reads, writes and verifies the HTTP digest fields: RFC 9530's `Content-Digest`,
 * `Repr-Digest` and their `Want-*` preferences, and RFC 3230's legacy `Digest` that
 * draft-cavage HTTP signatures still cover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { DigestErrorCode } from "./errors.js";
export type {
	DigestAlgorithm,
	DigestField,
	DigestValueField,
	Digests,
	FieldValues,
	Preferences,
} from "./types.js";
export type { VerifyOptions } from "./verify.js";

export { DIGEST_ALGORITHMS, digest } from "./digest.js";
export { DigestError } from "./errors.js";
export { parse } from "./parse.js";
export { stringify } from "./stringify.js";
export { verify } from "./verify.js";
