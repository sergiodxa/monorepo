import { InvalidBase32CharacterError, InvalidBase32StringError } from "./errors";
import { assertUUID } from "./uuid";

export type Base32 = string & { __base32: never };

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const LOOKUP = new Map(ALPHABET.split("").map((character, index) => [character, index]));

const BASE = 32n;
const MAX_FIRST_CHARACTER = 7;
const SUFFIX_LENGTH = 26;

/**
 * Encodes a UUID string into a 26-character TypeID Base32 suffix.
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
 */
export function decode(base32: Base32): string {
	let value = 0n;

	if (base32.length !== SUFFIX_LENGTH) throw new InvalidBase32StringError();

	for (let character of base32) {
		let index = LOOKUP.get(character);
		if (index === undefined) throw new InvalidBase32CharacterError(character);
		if (value === 0n && index > MAX_FIRST_CHARACTER) throw new InvalidBase32StringError();

		value = value * BASE + BigInt(index);
	}

	let hex = value.toString(16).padStart(32, "0");
	let uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

	assertUUID(uuid);
	return uuid;
}

/**
 * Checks whether a value is a valid TypeID Base32 suffix.
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
