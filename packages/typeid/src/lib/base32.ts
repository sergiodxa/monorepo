/**
 * Crockford Base32 encoding and decoding for TypeID suffixes, mapping
 * between UUID strings and their 26-character Base32 representation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { assertUUID } from "@sdxc/uuid";

import { InvalidBase32CharacterError, InvalidBase32StringError } from "./errors.js";

export type Base32 = string & { __base32: never };

/** Crockford's Base32 alphabet used by the TypeID specification. */
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

/** Character to index lookup table for fast decoding. */
const LOOKUP = new Map(ALPHABET.split("").map((character, index) => [character, index]));

/** Base radix used for encoding and decoding. */
const BASE = 32n;

/** Maximum allowed value for the first character (prevents 128-bit overflow). */
const MAX_FIRST_CHARACTER = 7;

/** Number of Base32 characters used to encode UUID values. */
const SUFFIX_LENGTH = 26;

/**
 * Encodes a UUID string into a 26-character TypeID Base32 suffix.
 * @param string UUID string to encode.
 * @returns Encoded TypeID Base32 suffix.
 * @throws {InvalidUUIDFormatError} If the UUID is not in canonical lowercase format.
 * @throws {InvalidUUIDLengthError} If the UUID does not have 36 characters.
 * @throws {InvalidUUIDTypeError} If the UUID is not a string.
 * @example
 * let suffix = encode("550e8400-e29b-41d4-a716-446655440000");
 * // "01arz3ndektsv4rrffq69g5fav"
 */
export function encode(string: string): Base32 {
	assertUUID(string);

	let value = BigInt(`0x${string.replaceAll("-", "")}`);
	let output = "";

	output += ALPHABET[Number(value >> 125n)] ?? "";

	for (let index = 1; index < SUFFIX_LENGTH; index += 1) {
		let shift = BigInt(125 - index * 5);
		output += ALPHABET[Number((value >> shift) & 31n)] ?? "";
	}

	return output as Base32;
}

/**
 * Decodes a 26-character TypeID Base32 suffix into a UUID string.
 * @param base32 Base32 suffix to decode.
 * @returns Decoded UUID string.
 * @throws {InvalidBase32CharacterError} If the suffix contains invalid Base32 characters.
 * @throws {InvalidBase32StringError} If the suffix overflows 128 bits or has an invalid shape.
 * @throws {InvalidUUIDFormatError} If decoded content cannot be represented as a canonical UUID.
 * @throws {InvalidUUIDLengthError} If decoded content has an invalid UUID length.
 * @throws {InvalidUUIDTypeError} If decoded content is not a string UUID value.
 * @example
 * let uuid = decode("01arz3ndektsv4rrffq69g5fav" as Base32);
 * // "550e8400-e29b-41d4-a716-446655440000"
 */
export function decode(base32: Base32): string {
	let value = 0n;

	if (base32.length !== SUFFIX_LENGTH) throw new InvalidBase32StringError();

	for (let position = 0; position < base32.length; position += 1) {
		let character = base32[position] ?? "";
		let index = LOOKUP.get(character);
		if (index === undefined) throw new InvalidBase32CharacterError(character);
		if (position === 0 && index > MAX_FIRST_CHARACTER) throw new InvalidBase32StringError();

		value = value * BASE + BigInt(index);
	}

	let hex = value.toString(16).padStart(32, "0");
	let uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

	assertUUID(uuid);
	return uuid;
}

/**
 * Checks whether a value is a valid TypeID Base32 suffix.
 * @param value Value to validate.
 * @returns Whether the value is a valid Base32 suffix.
 * @example
 * isBase32("01arz3ndektsv4rrffq69g5fav");
 * // true
 */
export function isBase32(value: unknown): value is Base32 {
	if (typeof value !== "string") return false;
	if (value.length !== SUFFIX_LENGTH) return false;

	for (let character of value) {
		if (!LOOKUP.has(character)) return false;
	}

	try {
		decode(value as Base32);
		return true;
	} catch {
		return false;
	}
}
