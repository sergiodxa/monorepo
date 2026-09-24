/**
 * The bare item wrappers for the three RFC 9651 types a JavaScript primitive cannot tell
 * apart from another type: Token from String, Decimal from Integer, Display String from
 * String. Each keeps its type through a parse and stringify round trip.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * An sf-token: a bare word such as `HIT` or `text/html`, distinct from the sf-string `"HIT"`.
 * Construction always succeeds; `stringify` checks the token grammar when it writes one.
 */
export class Token {
	readonly value: string;

	/**
	 * @param value - The token text, written without quotes
	 */
	constructor(value: string) {
		this.value = value;
	}

	/**
	 * @returns The token text, so a Token interpolates as the word it carries
	 */
	toString(): string {
		return this.value;
	}
}

/**
 * An sf-decimal, so `1.0` stays a Decimal through a round trip where a plain `1` would be
 * written as an Integer. `stringify` rounds it half-to-even to three fractional digits.
 */
export class Decimal {
	readonly value: number;

	/**
	 * @param value - The number to write as a Decimal
	 */
	constructor(value: number) {
		this.value = value;
	}

	/**
	 * @returns The number, so a Decimal takes part in arithmetic and comparisons directly
	 */
	valueOf(): number {
		return this.value;
	}
}

/**
 * An sf-displaystring: Unicode text, written as `%"…"` with its non-ASCII UTF-8 bytes
 * percent-encoded. A plain JavaScript string is an sf-string, which only carries ASCII.
 */
export class DisplayString {
	readonly value: string;

	/**
	 * @param value - The Unicode text to carry
	 */
	constructor(value: string) {
		this.value = value;
	}

	/**
	 * @returns The Unicode text
	 */
	toString(): string {
		return this.value;
	}
}
