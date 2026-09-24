/**
 * The RFC 9309 matcher: patterns and paths brought to one percent-encoding, and a wildcard
 * comparison that supports `*` for any run and a trailing `$` for the end of the path. The
 * comparison walks both strings with a single backtrack point, so no regular expression is ever
 * built from a file's contents.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** RFC 3986 unreserved characters, whose percent-encoded form means the same character. */
const UNRESERVED = /^[A-Za-z0-9\-._~]$/;

/** The base a path-only string is resolved against, which never reaches the result. */
const PATH_BASE = "http://robots.invalid";

/**
 * Brings text to the one form RFC 9309 compares in: non-ASCII characters percent-encoded as
 * UTF-8, escapes uppercased, and escapes of unreserved characters decoded.
 *
 * @param text - A pattern or a path.
 * @param literal - Characters to percent-encode where they appear raw, so a raw `*` or `$` in a
 *   URL matches a pattern that spells it `%2A` or `%24`.
 */
export function normalize(text: string, literal = ""): string {
	let result = "";

	for (let index = 0; index < text.length; index++) {
		let character = text[index] ?? "";

		if (character === "%" && /^[0-9A-Fa-f]{2}$/.test(text.slice(index + 1, index + 3))) {
			let hex = text.slice(index + 1, index + 3).toUpperCase();
			let decoded = String.fromCharCode(Number.parseInt(hex, 16));
			result += UNRESERVED.test(decoded) ? decoded : `%${hex}`;
			index += 2;
			continue;
		}

		let code = character.codePointAt(0) ?? 0;
		if (code > 0x7f) {
			let full = String.fromCodePoint(code);
			result += encodeCharacter(full);
			index += full.length - 1;
			continue;
		}

		if (literal.includes(character)) {
			result += `%${code.toString(16).toUpperCase().padStart(2, "0")}`;
			continue;
		}

		result += character;
	}

	return result;
}

/**
 * One non-ASCII character as UTF-8 escapes; a lone surrogate, which has no UTF-8 form, as the
 * replacement character's.
 */
function encodeCharacter(character: string): string {
	try {
		return encodeURIComponent(character);
	} catch {
		return "%EF%BF%BD";
	}
}

/**
 * The part of a URL a rule is matched against: its path and query, normalized, with the
 * fragment dropped. A string starting with `/` is read as a path on its own.
 *
 * @param url - An absolute URL, or a path.
 * @returns The path to match, or `null` for a string that is neither.
 */
export function pathToMatch(url: string | URL): string | null {
	let parsed: URL;
	try {
		parsed =
			typeof url === "string" && url.startsWith("/") && !url.startsWith("//")
				? new URL(url, PATH_BASE)
				: new URL(url);
	} catch {
		return null;
	}

	return normalize(`${parsed.pathname || "/"}${parsed.search}`, "*$");
}

/** A rule's pattern ready to compare: normalized, and whether it is anchored to the end. */
export interface CompiledPattern {
	body: string;
	anchored: boolean;
}

/**
 * Prepares a pattern for {@link matches}: a trailing `$` becomes the end anchor, and any other
 * `$` a literal, encoded as a URL's `$` is.
 *
 * @param pattern - The pattern as the file wrote it.
 */
export function compilePattern(pattern: string): CompiledPattern {
	let anchored = pattern.endsWith("$");
	let body = anchored ? pattern.slice(0, -1) : pattern;
	return { body: normalize(body, "$"), anchored };
}

/**
 * Whether a compiled pattern matches a path from its first octet: `*` matches any run of
 * characters, and an anchored pattern must consume the whole path.
 *
 * @param pattern - The compiled pattern.
 * @param path - The normalized path to match.
 */
export function matches(pattern: CompiledPattern, path: string): boolean {
	let { body, anchored } = pattern;
	let p = 0;
	let s = 0;
	let star = -1;
	let resume = 0;

	while (s < path.length) {
		if (p < body.length && body[p] === "*") {
			star = p++;
			resume = s;
			continue;
		}

		if (p < body.length && body[p] === path[s]) {
			p++;
			s++;
			continue;
		}

		if (p === body.length && !anchored) return true;

		if (star === -1) return false;
		p = star + 1;
		s = ++resume;
	}

	while (p < body.length && body[p] === "*") p++;
	return p === body.length;
}
