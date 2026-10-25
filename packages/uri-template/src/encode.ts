/**
 * Percent-encoding for template expansion: values keep only unreserved characters, or for
 * `+` and `#` also reserved characters and existing percent-encodings, and literal text
 * keeps everything a URI may hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** RFC 3986 unreserved characters, which every expansion leaves as they are. */
const UNRESERVED = /[A-Za-z0-9\-._~]/;

/** RFC 3986 reserved characters, which `+` and `#` expansion leaves as they are. */
const RESERVED = /[:/?#[\]@!$&'()*+,;=]/;

/** A percent-encoded octet. */
const PERCENT_ENCODED = /^%[0-9A-Fa-f]{2}/;

/** The UTF-8 bytes of one character, each as `%XX` with uppercase hex. */
function percentEncode(char: string): string {
	let out = "";
	for (let byte of new TextEncoder().encode(char)) {
		out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
	}
	return out;
}

/**
 * A variable's value as an expansion writes it.
 *
 * @param value - The string value.
 * @param allowReserved - Whether reserved characters and `%XX` triplets pass through.
 */
export function encodeValue(value: string, allowReserved: boolean): string {
	let out = "";
	for (let index = 0; index < value.length;) {
		let char = String.fromCodePoint(value.codePointAt(index) as number);
		if (allowReserved && char === "%" && PERCENT_ENCODED.test(value.slice(index, index + 3))) {
			out += value.slice(index, index + 3);
			index += 3;
			continue;
		}
		if (UNRESERVED.test(char) || (allowReserved && RESERVED.test(char))) out += char;
		else out += percentEncode(char);
		index += char.length;
	}
	return out;
}

/**
 * Literal template text as expansion copies it: the characters section 2.1 allows stay, and
 * the non-ASCII ones a URI cannot hold are percent-encoded as UTF-8.
 *
 * @param text - Literal text that the parser already checked against section 2.1.
 */
export function encodeLiteral(text: string): string {
	let out = "";
	for (let char of text) out += (char.codePointAt(0) as number) < 0x80 ? char : percentEncode(char);
	return out;
}
