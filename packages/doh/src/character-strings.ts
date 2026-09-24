/**
 * Reads the character-strings of TXT RDATA in presentation format (RFC 1035 section 5.1):
 * quoted strings keep their spaces, bare words split on whitespace, and `\"`, `\\` and
 * `\DDD` escapes are decoded, so a resolver's quoting never leaks into the text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { RecordDataError } from "./errors.js";

/** Decodes a character-string's octets as UTF-8, replacing invalid sequences with U+FFFD. */
const DECODER = new TextDecoder();

/** Encodes literal characters into the octets they stand for. */
const ENCODER = new TextEncoder();

/** Whether a character separates character-strings. */
function isSpace(char: string | undefined): boolean {
	return char === " " || char === "\t" || char === "\n" || char === "\r";
}

/**
 * Splits TXT presentation data into its character-strings. Escapes are decoded to octets
 * and each string is read as UTF-8, so text a resolver writes as `\195\169` comes back as
 * `é`. Fails on an unterminated quote or a decimal escape above 255.
 *
 * @param data - One or more quoted or bare character-strings.
 * @returns The strings in order, empty strings included.
 * @example readCharacterStrings('"v=DKIM1; p=AAA" "BBB"') // success(["v=DKIM1; p=AAA", "BBB"])
 */
export function readCharacterStrings(data: string): Result<string[], RecordDataError> {
	let chars = Array.from(data);
	let strings: string[] = [];
	let index = 0;

	while (index < chars.length) {
		if (isSpace(chars[index])) {
			index += 1;
			continue;
		}

		let quoted = chars[index] === '"';
		if (quoted) index += 1;

		let octets: number[] = [];
		let terminated = !quoted;

		while (index < chars.length) {
			let char = chars[index] ?? "";

			if (quoted && char === '"') {
				terminated = true;
				index += 1;
				break;
			}
			if (!quoted && isSpace(char)) break;

			if (char === "\\") {
				let digits = chars.slice(index + 1, index + 4).join("");
				if (/^\d{3}$/.test(digits)) {
					let octet = Number(digits);
					if (octet > 255)
						return failure(new RecordDataError(`Invalid escape \\${digits} in TXT data`));
					octets.push(octet);
					index += 4;
					continue;
				}
				let next = chars[index + 1];
				if (next === undefined)
					return failure(new RecordDataError("TXT data ends in a lone backslash"));
				octets.push(...ENCODER.encode(next));
				index += 2;
				continue;
			}

			octets.push(...ENCODER.encode(char));
			index += 1;
		}

		if (!terminated)
			return failure(new RecordDataError("TXT data has an unterminated quoted string"));
		strings.push(DECODER.decode(new Uint8Array(octets)));
	}

	return success(strings);
}

/** Decodes octets as UTF-8, the reading applied to every character-string. */
export function decodeOctets(octets: Uint8Array): string {
	return DECODER.decode(octets);
}
