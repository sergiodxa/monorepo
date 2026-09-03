/**
 * Strings with a shape: identifiers, tokens, and the character runs a field
 * length test needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "../random.js";

/** Digits and every lowercase letter, the 36 characters base 36 spells. */
const ALPHANUMERIC_RADIX = 36;

const HEX_RADIX = 16;

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

const DIGITS = "0123456789";

const SYMBOLS = "!\"#$%&'()*+,-./:;<=>?@[]^_`{|}~";

/** The printable range a sampled string draws from. */
const PRINTABLE_FIRST = 33;
const PRINTABLE_LAST = 125;

/** Nanoid's alphabet: URL-safe, 64 characters. */
const NANOID_ALPHABET = `${LETTERS}${LETTERS.toUpperCase()}${DIGITS}_-`;

/** Crockford base32, the encoding a ULID is written in. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** How many characters each half of a ULID takes. */
const ULID_TIME_LENGTH = 10;
const ULID_RANDOM_LENGTH = 16;

/** Options for a run of letters. */
export interface AlphaOptions {
	/** Which case the letters take. Defaults to lowercase. */
	casing?: "lower" | "upper" | "mixed";
}

/** Options for a hexadecimal run. */
export interface HexadecimalOptions extends AlphaOptions {
	/** Text placed before the digits, such as `"0x"`. Empty by default. */
	prefix?: string;
}

/** Identifiers, tokens, and character runs. */
export interface StringModule {
	/**
	 * A version 4 UUID drawn from the seeded stream, so the same seed yields the
	 * same identifier. It carries the format and none of the unpredictability
	 * that makes a real one hard to guess.
	 */
	uuid(): string;
	/** A ULID: a timestamp from the reference instant, then random characters. */
	ulid(): string;
	/** A 21-character nanoid, or another length on request. */
	nanoid(length?: number): string;
	/** `length` letters, lowercase by default. */
	alpha(length: number, options?: AlphaOptions): string;
	/** `length` lowercase letters and digits. */
	alphanumeric(length: number): string;
	/** `length` digits. */
	numeric(length: number): string;
	/** `length` hexadecimal digits, lowercase by default. */
	hexadecimal(length: number, options?: HexadecimalOptions): string;
	/** `length` binary digits, prefixed `0b`. */
	binary(length: number): string;
	/** `length` octal digits, prefixed `0o`. */
	octal(length: number): string;
	/** `length` punctuation characters. */
	symbol(length: number): string;
	/** `length` characters drawn from the printable ASCII range. */
	sample(length: number): string;
	/** `length` characters drawn from the caller's own alphabet. */
	fromCharacters(characters: string, length: number): string;
}

/** Reject a length that is not a count, naming the tool that was asked. */
function checkLength(length: number, name: string): void {
	if (!Number.isSafeInteger(length) || length < 0) {
		throw new RangeError(`${name}() needs a length of zero or more, received ${length}.`);
	}
}

/**
 * Draw `length` digits of a base, which spells each character from the digit's
 * own value: base 16 covers `0-9a-f` and base 36 covers `0-9a-z`.
 */
function run(random: Random, radix: number, length: number, name: string): string {
	checkLength(length, name);
	return Array.from({ length }, () => random.int(0, radix - 1).toString(radix)).join("");
}

/** Apply the casing an alphabetic run was asked for. */
function cased(random: Random, value: string, casing: AlphaOptions["casing"]): string {
	if (casing === "upper") return value.toUpperCase();
	if (casing === "mixed") {
		// oxlint-disable-next-line typescript/no-misused-spread -- ASCII only
		return [...value]
			.map((character) => (random.bool() ? character.toUpperCase() : character))
			.join("");
	}
	return value;
}

/** Create the `string` module over one stream and a reference instant. */
export function createStringModule(random: Random, now: Date): StringModule {
	let string: StringModule = {
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
		ulid() {
			let timestamp = now.getTime();
			let time = "";
			for (let index = 0; index < ULID_TIME_LENGTH; index++) {
				time = CROCKFORD.charAt(timestamp % 32) + time;
				timestamp = Math.floor(timestamp / 32);
			}
			let tail = Array.from({ length: ULID_RANDOM_LENGTH }, () =>
				CROCKFORD.charAt(random.int(0, CROCKFORD.length - 1)),
			).join("");
			return `${time}${tail}`;
		},
		nanoid(length = 21) {
			return string.fromCharacters(NANOID_ALPHABET, length);
		},
		alpha(length, options = {}) {
			checkLength(length, "alpha");
			let value = Array.from({ length }, () =>
				LETTERS.charAt(random.int(0, LETTERS.length - 1)),
			).join("");
			return cased(random, value, options.casing);
		},
		alphanumeric(length) {
			return run(random, ALPHANUMERIC_RADIX, length, "alphanumeric");
		},
		numeric(length) {
			checkLength(length, "numeric");
			return Array.from({ length }, () => String(random.int(0, 9))).join("");
		},
		hexadecimal(length, options = {}) {
			let digits = run(random, HEX_RADIX, length, "hexadecimal");
			return `${options.prefix ?? ""}${cased(random, digits, options.casing)}`;
		},
		binary(length) {
			checkLength(length, "binary");
			return `0b${Array.from({ length }, () => String(random.int(0, 1))).join("")}`;
		},
		octal(length) {
			checkLength(length, "octal");
			return `0o${Array.from({ length }, () => String(random.int(0, 7))).join("")}`;
		},
		symbol(length) {
			return string.fromCharacters(SYMBOLS, length);
		},
		sample(length) {
			checkLength(length, "sample");
			return Array.from({ length }, () =>
				String.fromCharCode(random.int(PRINTABLE_FIRST, PRINTABLE_LAST)),
			).join("");
		},
		fromCharacters(characters, length) {
			checkLength(length, "fromCharacters");
			if (characters.length === 0) {
				throw new RangeError("fromCharacters() needs at least one character to draw from.");
			}
			return Array.from({ length }, () =>
				characters.charAt(random.int(0, characters.length - 1)),
			).join("");
		},
	};

	return string;
}
