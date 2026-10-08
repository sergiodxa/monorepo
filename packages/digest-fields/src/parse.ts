/**
 * Reads a digest field into its value model: RFC 9530 fields through the Structured Field
 * grammar, and RFC 3230's `Digest` through its own comma-separated `ALG=base64` grammar,
 * so a caller holds one shape whichever field a sender used.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { SF } from "@sdxc/structured-fields";

import { Base64 } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";
import { parse as parseStructured } from "@sdxc/structured-fields";

import type { DigestField, Digests, FieldValues, Preferences } from "./types.js";

import { isDigestAlgorithm } from "./digest.js";
import { DigestError } from "./errors.js";

/** The highest weight a `Want-*-Digest` preference may carry (RFC 9530 §4). */
const MAX_PREFERENCE = 10;

/**
 * Parses a field value into its model.
 *
 * `Content-Digest` and `Repr-Digest` answer digest bytes keyed by algorithm, and the
 * `Want-*` fields answer preference weights. `Digest` reads algorithm names in any case
 * and keys them lowercase; an entry for an algorithm outside `sha-256`/`sha-512` whose
 * value is not base64 (RFC 3230's `UNIXsum`, say) is left out.
 *
 * @param value - The field value, several field lines joined with `, ` as `Headers#get` does.
 * @param field - Which field the value came from, lowercase.
 * @returns The model, or `malformed` naming why the value does not fit the field.
 * @example parse("sha-256=:X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=:", "content-digest")
 * @example parse("SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=", "digest")
 */
export function parse<Field extends DigestField>(
	value: string,
	field: Field,
): Result<FieldValues[Field], DigestError>;
export function parse(
	value: string,
	field: DigestField,
): Result<Digests | Preferences, DigestError> {
	if (field === "digest") return parseLegacy(value);
	if (field === "content-digest" || field === "repr-digest") return parseDigests(value, field);
	return parsePreferences(value, field);
}

/**
 * Reads an RFC 9530 Dictionary whose members are Byte Sequences.
 *
 * @param value - The field value.
 * @param field - The field name, for the message.
 */
function parseDigests(value: string, field: string): Result<Digests, DigestError> {
	let parsed = parseDictionary(value, field);
	if (isFailure(parsed)) return parsed;

	let entries: Array<[string, Uint8Array]> = [];
	for (let [algorithm, member] of Object.entries(parsed.data)) {
		if (!("value" in member) || !(member.value instanceof Uint8Array)) {
			return failure(malformed(field, `${algorithm} is not a byte sequence`));
		}
		entries.push([algorithm, member.value]);
	}
	return success(Object.fromEntries(entries));
}

/**
 * Reads an RFC 9530 `Want-*` Dictionary whose members are Integers from 0 to 10.
 *
 * @param value - The field value.
 * @param field - The field name, for the message.
 */
function parsePreferences(value: string, field: string): Result<Preferences, DigestError> {
	let parsed = parseDictionary(value, field);
	if (isFailure(parsed)) return parsed;

	let entries: Array<[string, number]> = [];
	for (let [algorithm, member] of Object.entries(parsed.data)) {
		if (!("value" in member) || !isPreference(member.value)) {
			return failure(malformed(field, `${algorithm} is not an integer from 0 to 10`));
		}
		entries.push([algorithm, member.value]);
	}
	return success(Object.fromEntries(entries));
}

/**
 * Parses the Structured Field Dictionary every RFC 9530 field is defined as.
 *
 * @param value - The field value.
 * @param field - The field name, for the message.
 */
function parseDictionary(value: string, field: string): Result<SF.Dictionary, DigestError> {
	let parsed = parseStructured(value, "dictionary");
	if (isFailure(parsed)) {
		return failure(
			new DigestError("malformed", `Malformed ${field}: ${parsed.error.message}`, {
				cause: parsed.error,
			}),
		);
	}
	return parsed;
}

/**
 * Reads RFC 3230's `Digest`: `ALG=base64` entries separated by commas. Empty entries,
 * which a trailing comma leaves, are skipped.
 *
 * @param value - The field value.
 */
function parseLegacy(value: string): Result<Digests, DigestError> {
	let entries: Array<[string, Uint8Array]> = [];

	for (let entry of value.split(",")) {
		let trimmed = entry.trim();
		if (trimmed === "") continue;

		let separator = trimmed.indexOf("=");
		if (separator <= 0) return failure(malformed("digest", "an entry has no algorithm"));

		let algorithm = trimmed.slice(0, separator).trim().toLowerCase();
		let decoded = Base64.decode(trimmed.slice(separator + 1).trim());
		if (isFailure(decoded)) {
			if (isDigestAlgorithm(algorithm)) {
				return failure(malformed("digest", `${algorithm} is not base64`));
			}
			continue;
		}
		entries.push([algorithm, decoded.data]);
	}

	return success(Object.fromEntries(entries));
}

/**
 * Whether a bare item is a valid preference weight.
 *
 * @param value - The member's bare item.
 */
export function isPreference(value: unknown): value is number {
	return (
		typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_PREFERENCE
	);
}

/**
 * A `malformed` failure naming the field and the reason.
 *
 * @param field - The field name.
 * @param reason - What is wrong with it.
 */
function malformed(field: string, reason: string): DigestError {
	return new DigestError("malformed", `Malformed ${field}: ${reason}`);
}
