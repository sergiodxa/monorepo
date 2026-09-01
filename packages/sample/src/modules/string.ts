/**
 * Strings with a shape: identifiers, tokens, and the character runs a field
 * length test needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "../random";

/** Digits and every lowercase letter, the 36 characters base 36 spells. */
const ALPHANUMERIC_RADIX = 36;

const HEX_RADIX = 16;

/** Identifiers and character runs. */
export interface StringModule {
	/**
	 * A version 4 UUID drawn from the seeded stream, so the same seed yields the
	 * same identifier. It carries the format and none of the unpredictability
	 * that makes a real one hard to guess.
	 */
	uuid(): string;
	/** `length` lowercase letters and digits. */
	alphanumeric(length: number): string;
	/** `length` lowercase hexadecimal digits. */
	hex(length: number): string;
}

/**
 * Draw `length` digits of a base, which spells each character from the digit's
 * own value: base 16 covers `0-9a-f` and base 36 covers `0-9a-z`.
 */
function run(random: Random, radix: number, length: number, name: string): string {
	if (!Number.isSafeInteger(length) || length < 0) {
		throw new RangeError(`${name}() needs a length of zero or more, received ${length}.`);
	}
	return Array.from({ length }, () => random.int(0, radix - 1).toString(radix)).join("");
}

/** Create the `string` module over one stream. */
export function createStringModule(random: Random): StringModule {
	return {
		uuid() {
			let bytes = Array.from({ length: 16 }, () => random.int(0, 255));
			bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
			bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
			let hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
			return [
				hex.slice(0, 8),
				hex.slice(8, 12),
				hex.slice(12, 16),
				hex.slice(16, 20),
				hex.slice(20),
			].join("-");
		},
		alphanumeric(length) {
			return run(random, ALPHANUMERIC_RADIX, length, "alphanumeric");
		},
		hex(length) {
			return run(random, HEX_RADIX, length, "hex");
		},
	};
}
