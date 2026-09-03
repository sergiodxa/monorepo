/**
 * Resolves the entity and character references XML allows inside text nodes and
 * attribute values, and reports an undeclared reference as an error so a caller
 * always receives text that is fully decoded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/**
 * Matches a complete reference: an ampersand, a run of reference characters and
 * a semicolon. Prose containing a loose ampersand therefore reads as text.
 */
const REFERENCE_PATTERN = /&([^;&<\s]*);/g;

const DECIMAL_PATTERN = /^#([0-9]+)$/;
const HEXADECIMAL_PATTERN = /^#[xX]([0-9a-fA-F]+)$/;

const MAXIMUM_CODE_POINT = 0x10_ff_ff;
const FIRST_SURROGATE = 0xd8_00;
const LAST_SURROGATE = 0xdf_ff;

/**
 * The five entities XML predefines, and so the complete set available to a
 * document that declares its own entities through a DTD.
 */
const PREDEFINED_ENTITIES: Record<string, string> = {
	lt: "<",
	gt: ">",
	amp: "&",
	quot: '"',
	apos: "'",
};

/**
 * Replaces every reference in one run of parsed character data.
 *
 * @param value - Raw text taken straight from the source, still encoded
 * @returns A Result with the decoded text, or the first reference that failed
 */
export function decodeEntities(value: string): Result<string, Error> {
	if (!value.includes("&")) return success(value);

	let output = "";
	let cursor = 0;

	REFERENCE_PATTERN.lastIndex = 0;
	let match = REFERENCE_PATTERN.exec(value);

	while (match) {
		let resolved = resolveReference(match[1] ?? "");
		if (resolved.status === "failure") return resolved;

		output += value.slice(cursor, match.index) + resolved.data;
		cursor = match.index + match[0].length;
		match = REFERENCE_PATTERN.exec(value);
	}

	return success(output + value.slice(cursor));
}

/**
 * Resolves the text between `&` and `;` into the character it stands for.
 */
function resolveReference(reference: string): Result<string, Error> {
	let predefined = PREDEFINED_ENTITIES[reference];
	if (predefined) return success(predefined);

	let decimal = reference.match(DECIMAL_PATTERN);
	if (decimal?.[1]) return resolveCodePoint(reference, Number.parseInt(decimal[1], 10));

	let hexadecimal = reference.match(HEXADECIMAL_PATTERN);
	if (hexadecimal?.[1]) return resolveCodePoint(reference, Number.parseInt(hexadecimal[1], 16));

	if (reference.startsWith("#")) {
		return failure(new Error(`entity not matching Reference production: &${reference};`));
	}

	return failure(new Error(`entity not found:&${reference};`));
}

/**
 * Turns a numeric reference into its character, refusing the values that cannot
 * stand alone in a string: unpaired surrogates and anything past the last plane.
 */
function resolveCodePoint(reference: string, codePoint: number): Result<string, Error> {
	let outOfRange = codePoint === 0 || codePoint > MAXIMUM_CODE_POINT;
	let surrogate = codePoint >= FIRST_SURROGATE && codePoint <= LAST_SURROGATE;

	if (outOfRange || surrogate) {
		return failure(new Error(`entity not matching Reference production: &${reference};`));
	}

	return success(String.fromCodePoint(codePoint));
}
