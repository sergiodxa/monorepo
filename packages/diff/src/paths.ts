/**
 * Paths as git writes them in patch headers: wrapped in double quotes with C escapes and octal
 * UTF-8 bytes when they hold control characters, quotes, backslashes or non-ASCII text, bare
 * otherwise.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Single-letter C escapes git writes, by the character they stand for. */
const ESCAPES: Record<string, string> = {
	"\u0007": "a",
	"\b": "b",
	"\t": "t",
	"\n": "n",
	"\u000b": "v",
	"\f": "f",
	"\r": "r",
	'"': '"',
	"\\": "\\",
};

/** The characters `ESCAPES` writes, by their escape letter. */
const UNESCAPES: Record<string, number> = {
	a: 7,
	b: 8,
	t: 9,
	n: 10,
	v: 11,
	f: 12,
	r: 13,
	'"': 34,
	"\\": 92,
};

/** Encodes non-ASCII path characters into the UTF-8 bytes git escapes one by one. */
const ENCODER = new TextEncoder();

/** Decodes the bytes of a quoted path, which git escapes as octal UTF-8. */
const DECODER = new TextDecoder();

/** Whether git would quote this path. */
function needsQuotes(path: string): boolean {
	for (let i = 0; i < path.length; i++) {
		let c = path.charCodeAt(i);
		if (c < 32 || c === 34 || c === 92 || c >= 127) return true;
	}
	return false;
}

/**
 * Writes a path the way git does in a header line, quoting it only when needed.
 *
 * @example quotePath("ü.txt"); // "\"\\303\\274.txt\""
 */
export function quotePath(path: string): string {
	if (!needsQuotes(path)) return path;
	let out = '"';
	for (let char of path) {
		let escape = ESCAPES[char];
		let code = char.charCodeAt(0);
		if (escape) {
			out += `\\${escape}`;
		} else if (code < 32 || code >= 127) {
			for (let byte of ENCODER.encode(char)) out += `\\${byte.toString(8).padStart(3, "0")}`;
		} else {
			out += char;
		}
	}
	return `${out}"`;
}

/**
 * Reads a quoted path starting at the opening quote `text[start]`.
 *
 * @returns The decoded path and the offset just past its closing quote; an unterminated quote
 * runs to `end`.
 */
export function unquotePath(text: string, start: number, end: number): [string, number] {
	let bytes: number[] = [];
	let i = start + 1;
	while (i < end && text.charCodeAt(i) !== 34) {
		let c = text.charCodeAt(i);
		if (c === 92 && i + 1 < end) {
			let next = text[i + 1]!;
			let known = UNESCAPES[next];
			if (known !== undefined) {
				bytes.push(known);
				i += 2;
			} else {
				bytes.push(Number.parseInt(text.slice(i + 1, i + 4), 8) & 255);
				i += 4;
			}
		} else if (c < 128) {
			bytes.push(c);
			i++;
		} else {
			let point = text.codePointAt(i)!;
			let char = String.fromCodePoint(point);
			for (let byte of ENCODER.encode(char)) bytes.push(byte);
			i += char.length;
		}
	}
	return [DECODER.decode(new Uint8Array(bytes)), Math.min(i + 1, end)];
}

/** Drops a leading `a/` or `b/` prefix, which git adds to both sides of every header path. */
export function stripPrefix(path: string): string {
	return path.startsWith("a/") || path.startsWith("b/") ? path.slice(2) : path;
}
