/**
 * Translates RFC 9485 I-Regexp patterns into ECMAScript regular expressions for the
 * `match()` and `search()` function extensions, refusing anything outside the I-Regexp
 * grammar so a pattern means the same thing in every JSONPath implementation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The escape character, kept out of string escapes so generated patterns read plainly. */
const BACKSLASH = String.fromCharCode(0x5c);

/** Characters `\` may escape outside a property class (section 3, `SingleCharEsc`). */
const SINGLE_CHAR_ESCAPES = new Set("()*+-.?[\\]^{|}nrt".split(""));

/** Characters that are syntax in I-Regexp and so are never a `NormalChar`. */
const SYNTAX = new Set("()*+.?[\\]{|}".split(""));

/** The General Category values `\p{…}` and `\P{…}` may name. */
const CATEGORIES = new Set(
	"L Ll Lm Lo Lt Lu M Mc Me Mn N Nd Nl No P Pc Pd Pe Pf Pi Po Ps Z Zl Zp Zs S Sc Sk Sm So C Cc Cf Cn Co".split(
		" ",
	),
);

/** Compiled patterns, keyed by mode and source, since filters reuse the same literal per node. */
const CACHE = new Map<string, RegExp | null>();

/**
 * The ECMAScript regular expression for an I-Regexp: anchored at both ends for `"match"`,
 * unanchored for `"search"`. `.` matches any character but line feed and carriage return, and
 * `^`/`$` anchor, as the JSONPath compliance suite expects.
 *
 * @param pattern - The I-Regexp source.
 * @param mode - Whole-string or substring matching.
 * @returns The expression, or `null` when the pattern is not a valid I-Regexp.
 */
export function compileIRegexp(pattern: string, mode: "match" | "search"): RegExp | null {
	let key = `${mode}:${pattern}`;
	let cached = CACHE.get(key);
	if (cached !== undefined) return cached;
	let source = translate(pattern);
	let compiled: RegExp | null = null;
	if (source !== null) {
		try {
			compiled = new RegExp(mode === "match" ? `^(?:${source})$` : source, "u");
		} catch {
			compiled = null;
		}
	}
	CACHE.set(key, compiled);
	return compiled;
}

/** A character as a `\u{…}` escape, which means the character itself anywhere in a `u` pattern. */
function literal(code: number): string {
	return `${BACKSLASH}u{${code.toString(16)}}`;
}

/** Walks the I-Regexp grammar and writes the equivalent ECMAScript source, or `null` on a syntax error. */
function translate(pattern: string): string | null {
	let chars = Array.from(pattern);
	let pos = 0;
	let out = "";
	let depth = 0;
	/** Whether the previous token can take a quantifier. */
	let quantifiable = false;

	while (pos < chars.length) {
		let char = chars[pos] as string;
		let code = char.codePointAt(0) as number;
		if (code >= 0xd800 && code <= 0xdfff) return null;

		if (char === "(") {
			depth++;
			out += "(?:";
			pos++;
			quantifiable = false;
			continue;
		}
		if (char === ")") {
			if (depth === 0) return null;
			depth--;
			out += ")";
			pos++;
			quantifiable = true;
			continue;
		}
		if (char === "|") {
			out += "|";
			pos++;
			quantifiable = false;
			continue;
		}
		if (char === "*" || char === "+" || char === "?") {
			if (!quantifiable) return null;
			out += char;
			pos++;
			quantifiable = false;
			continue;
		}
		if (char === "{") {
			if (!quantifiable) return null;
			let end = chars.indexOf("}", pos);
			if (end === -1) return null;
			let body = chars.slice(pos + 1, end).join("");
			if (!/^\d+(?:,\d*)?$/.test(body)) return null;
			out += `{${body}}`;
			pos = end + 1;
			quantifiable = false;
			continue;
		}
		if (char === ".") {
			out += `[^${literal(0x0a)}${literal(0x0d)}]`;
			pos++;
			quantifiable = true;
			continue;
		}
		if (char === "[") {
			let parsed = characterClass(chars, pos);
			if (parsed === null) return null;
			out += parsed.source;
			pos = parsed.end;
			quantifiable = true;
			continue;
		}
		if (char === BACKSLASH) {
			let parsed = escape(chars, pos);
			if (parsed === null) return null;
			out += parsed.source;
			pos = parsed.end;
			quantifiable = true;
			continue;
		}
		if (SYNTAX.has(char)) return null;
		if (char === "^" || char === "$") {
			out += char;
			pos++;
			quantifiable = false;
			continue;
		}
		out += literal(code);
		pos++;
		quantifiable = true;
	}
	return depth === 0 ? out : null;
}

/** One escape at `pos`: a single-character escape, or a `\p{…}`/`\P{…}` category. */
function escape(
	chars: string[],
	pos: number,
): { source: string; end: number; code?: number } | null {
	let next = chars[pos + 1];
	if (next === undefined) return null;
	if (next === "p" || next === "P") {
		if (chars[pos + 2] !== "{") return null;
		let close = chars.indexOf("}", pos + 3);
		if (close === -1) return null;
		let name = chars.slice(pos + 3, close).join("");
		if (!CATEGORIES.has(name)) return null;
		return { source: `${BACKSLASH}${next}{${name}}`, end: close + 1 };
	}
	if (!SINGLE_CHAR_ESCAPES.has(next)) return null;
	let code = { n: 0x0a, r: 0x0d, t: 0x09 }[next as "n"] ?? (next.codePointAt(0) as number);
	return { source: literal(code), end: pos + 2, code };
}

/** A bracket expression at `pos`, written with every literal escaped so ECMAScript reads it alike. */
function characterClass(chars: string[], pos: number): { source: string; end: number } | null {
	let i = pos + 1;
	let out = "[";
	if (chars[i] === "^") {
		out += "^";
		i++;
	}
	let first = true;
	for (;;) {
		let char = chars[i];
		if (char === undefined) return null;
		if (char === "]" && !first) return { source: `${out}]`, end: i + 1 };
		if (char === "-") {
			let atEdge = first || chars[i + 1] === "]";
			if (!atEdge) return null;
			out += literal(0x2d);
			i++;
			first = false;
			continue;
		}
		let start = classChar(chars, i);
		if (start === null) return null;
		i = start.end;
		if (
			start.code !== undefined &&
			chars[i] === "-" &&
			chars[i + 1] !== "]" &&
			chars[i + 1] !== undefined
		) {
			let end = classChar(chars, i + 1);
			if (end === null || end.code === undefined || end.code < start.code) return null;
			out += `${start.source}-${end.source}`;
			i = end.end;
		} else {
			out += start.source;
		}
		first = false;
	}
}

/** One `CCchar` or category escape inside a bracket expression; `code` is set for single characters. */
function classChar(
	chars: string[],
	pos: number,
): { source: string; end: number; code?: number } | null {
	let char = chars[pos] as string;
	if (char === BACKSLASH) return escape(chars, pos);
	if (char === "[" || char === "]" || char === "-") return null;
	let code = char.codePointAt(0) as number;
	if (code >= 0xd800 && code <= 0xdfff) return null;
	return { source: literal(code), end: pos + 1, code };
}
