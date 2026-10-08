/**
 * Writes a digest field from its value model: RFC 9530 fields as canonical Structured
 * Field Dictionaries, and RFC 3230's `Digest` with the uppercase algorithm names and
 * padded base64 that every draft-cavage verifier reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Base64 } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";
import { stringify as stringifyStructured } from "@sdxc/structured-fields";

import type { DigestField, Digests, FieldValues, Preferences } from "./types.js";

import { DigestError } from "./errors.js";
import { isPreference } from "./parse.js";

/** An RFC 3230 algorithm name: a token, which keeps `=` and `,` out of it. */
const LEGACY_ALGORITHM_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/**
 * Serializes a field value. An empty value answers `""`, which a caller reads as "do not
 * send the field".
 *
 * @param value - Digest bytes, or preference weights for a `Want-*` field, keyed by algorithm.
 * @param field - Which field to write, lowercase.
 * @returns The field text, or `invalid` for an algorithm name the field cannot carry or a
 *   weight outside 0 to 10.
 * @example stringify({ "sha-256": bytes }, "content-digest") // success("sha-256=:…:")
 * @example stringify({ "sha-256": bytes }, "digest") // success("SHA-256=…")
 */
export function stringify<Field extends DigestField>(
	value: FieldValues[Field],
	field: Field,
): Result<string, DigestError>;
export function stringify(
	value: Digests | Preferences,
	field: DigestField,
): Result<string, DigestError> {
	if (field === "digest") return stringifyLegacy(value as Digests);
	if (field === "content-digest" || field === "repr-digest") {
		return stringifyDictionary(value, field);
	}

	for (let [algorithm, weight] of Object.entries(value)) {
		if (!isPreference(weight)) {
			return failure(new DigestError("invalid", `${algorithm} must weigh an integer from 0 to 10`));
		}
	}
	return stringifyDictionary(value, field);
}

/**
 * Writes an RFC 9530 Dictionary, whose keys must be lowercase Structured Field keys.
 *
 * @param value - The members, byte sequences or integers.
 * @param field - The field name, for the message.
 */
function stringifyDictionary(
	value: Digests | Preferences,
	field: string,
): Result<string, DigestError> {
	let text = stringifyStructured(value, "dictionary");
	if (isFailure(text)) {
		return failure(
			new DigestError("invalid", `Invalid ${field}: ${text.error.message}`, { cause: text.error }),
		);
	}
	return success(text.data);
}

/**
 * Writes RFC 3230's `Digest`, with algorithm names uppercased as its registry spells them.
 *
 * @param value - Digest bytes keyed by algorithm.
 */
function stringifyLegacy(value: Digests): Result<string, DigestError> {
	let entries: string[] = [];
	for (let [algorithm, bytes] of Object.entries(value)) {
		if (!LEGACY_ALGORITHM_PATTERN.test(algorithm)) {
			return failure(new DigestError("invalid", "Invalid digest: an algorithm is not a token"));
		}
		entries.push(`${algorithm.toUpperCase()}=${Base64.encode(bytes)}`);
	}
	return success(entries.join(", "));
}
