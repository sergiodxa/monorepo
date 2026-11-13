/**
 * First-character dispatch for the scanner: reads each rule's pattern for the
 * characters a match can start with, so a position tries only the rules that
 * could claim it and a run no rule can start is taken in one step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Rule } from "./lexer.js";

/**
 * The characters a match can start with: a flag per ASCII code, and one flag
 * standing for every code unit above it. The analysis over-approximates, so a
 * character outside the set is one the pattern can never start a match on.
 */
export interface CharSet {
	ascii: Uint8Array;
	other: boolean;
}

/**
 * The rules of one mode, by the character at the cursor, each list in the
 * mode's own order so the first match still wins.
 */
export interface Dispatch {
	/** The candidate rules for each ASCII code. */
	ascii: Rule[][];
	/** The candidate rules for any code unit above ASCII. */
	other: Rule[];
	/** `1` for each ASCII code no rule can start a match on. */
	plain: Uint8Array;
	/** Whether no rule can start a match on a code unit above ASCII. */
	otherPlain: boolean;
}

/** One parsed piece of a pattern: what it can start with, and whether it can match nothing. */
interface Analysis {
	chars: CharSet;
	nullable: boolean;
}

/** The cursor over a pattern's source, and whether it met syntax it does not model. */
interface Parser {
	source: string;
	index: number;
	ignoreCase: boolean;
	dotAll: boolean;
	unknown: boolean;
}

const ASCII = 128;
const DIGITS: Array<[number, number]> = [[48, 57]];
const WORD: Array<[number, number]> = [
	[48, 57],
	[65, 90],
	[95, 95],
	[97, 122],
];
const SPACE: Array<[number, number]> = [
	[9, 13],
	[32, 32],
];
const DISPATCHES = new WeakMap<Rule[], Dispatch>();

/**
 * The dispatch table for a mode's rules, built once per rule list and reused
 * by every scan that enters the mode.
 *
 * @param rules - A mode's rules, in priority order
 * @returns The candidate rules per character
 */
export function dispatchFor(rules: Rule[]): Dispatch {
	let cached = DISPATCHES.get(rules);
	if (cached) return cached;

	let sets = rules.map((rule) => firstCharacters(rule.match));
	let ascii: Rule[][] = [];
	let plain = new Uint8Array(ASCII);

	for (let code = 0; code < ASCII; code++) {
		let candidates = rules.filter((_, index) => sets[index]?.ascii[code] === 1);
		ascii.push(candidates);
		plain[code] = candidates.length === 0 ? 1 : 0;
	}

	let other = rules.filter((_, index) => sets[index]?.other === true);
	let dispatch: Dispatch = { ascii, other, plain, otherPlain: other.length === 0 };
	DISPATCHES.set(rules, dispatch);
	return dispatch;
}

/**
 * The characters a pattern's match can start with. A pattern whose start the
 * analysis cannot pin down — a backreference, Unicode mode, a pattern that
 * can match nothing — comes back as every character, so it is always tried.
 *
 * @param pattern - A rule's pattern
 * @returns The set of possible first characters
 */
export function firstCharacters(pattern: RegExp): CharSet {
	if (pattern.unicode || pattern.flags.includes("v")) return everything();

	let parser: Parser = {
		source: pattern.source,
		index: 0,
		ignoreCase: pattern.ignoreCase,
		dotAll: pattern.dotAll,
		unknown: false,
	};
	let analysis = disjunction(parser);

	if (parser.unknown || analysis.nullable || parser.index < parser.source.length) {
		return everything();
	}

	return analysis.chars;
}

/** A set no character is in. */
function nothing(): CharSet {
	return { ascii: new Uint8Array(ASCII), other: false };
}

/** A set every character is in. */
function everything(): CharSet {
	return { ascii: new Uint8Array(ASCII).fill(1), other: true };
}

/** Adds every member of `from` to `into`. */
function union(into: CharSet, from: CharSet) {
	for (let code = 0; code < ASCII; code++) if (from.ascii[code] === 1) into.ascii[code] = 1;
	if (from.other) into.other = true;
}

/** Adds one code unit, or the flag for all of them above ASCII. */
function addCode(set: CharSet, code: number) {
	if (code < ASCII) set.ascii[code] = 1;
	else set.other = true;
}

/** Adds an inclusive range of code units. */
function addRange(set: CharSet, from: number, to: number) {
	for (let code = from; code <= Math.min(to, ASCII - 1); code++) set.ascii[code] = 1;
	if (to >= ASCII) set.other = true;
}

/** A set of ASCII ranges, optionally complemented; either way it reaches every non-ASCII unit an escape like `\s` or `\W` can. */
function fromRanges(ranges: Array<[number, number]>, negate: boolean, other: boolean): CharSet {
	let set = nothing();
	for (let [from, to] of ranges) addRange(set, from, to);
	if (negate) {
		for (let code = 0; code < ASCII; code++) set.ascii[code] = set.ascii[code] === 1 ? 0 : 1;
		set.other = true;
	} else set.other = other;
	return set;
}

/**
 * Widens a set to both cases of every letter in it. Outside Unicode mode a
 * non-ASCII character never folds onto an ASCII one, but the set is widened to
 * every non-ASCII unit anyway, which keeps the analysis an over-approximation.
 */
function foldCase(set: CharSet): CharSet {
	for (let code = 65; code <= 90; code++) {
		if (set.ascii[code] === 1 || set.ascii[code + 32] === 1) {
			set.ascii[code] = 1;
			set.ascii[code + 32] = 1;
		}
	}
	set.other = true;
	return set;
}

/** Alternatives separated by `|`, up to the `)` or the end that closes them. */
function disjunction(parser: Parser): Analysis {
	let result = alternative(parser);

	while (parser.source[parser.index] === "|") {
		parser.index += 1;
		let next = alternative(parser);
		union(result.chars, next.chars);
		result.nullable ||= next.nullable;
	}

	return result;
}

/**
 * A sequence of terms. Its first characters are those of each term up to and
 * including the first one that has to consume something.
 */
function alternative(parser: Parser): Analysis {
	let chars = nothing();
	let nullable = true;

	while (parser.index < parser.source.length && !parser.unknown) {
		let character = parser.source[parser.index];
		if (character === "|" || character === ")") break;

		let next = term(parser);
		if (nullable) {
			union(chars, next.chars);
			nullable = next.nullable;
		}
	}

	return { chars, nullable };
}

/** One atom or assertion, with the quantifier that follows it. */
function term(parser: Parser): Analysis {
	let analysis = atom(parser);
	let quantifier = /^(?:[*?]|\{0(?:,\d*)?\})\??|^(?:\+|\{\d+(?:,\d*)?\})\??/.exec(
		parser.source.slice(parser.index, parser.index + 16),
	);
	if (!quantifier) return analysis;

	parser.index += quantifier[0].length;
	let optional =
		quantifier[0][0] === "*" || quantifier[0][0] === "?" || quantifier[0].startsWith("{0");
	return { chars: analysis.chars, nullable: analysis.nullable || optional };
}

/** A single atom: an assertion, a group, a class, an escape, `.`, or a literal. */
function atom(parser: Parser): Analysis {
	let character = parser.source[parser.index] ?? "";

	if (character === "^" || character === "$") {
		parser.index += 1;
		return { chars: nothing(), nullable: true };
	}

	if (character === "(") return group(parser);
	if (character === "[") return characterClass(parser);

	if (character === ".") {
		parser.index += 1;
		let set = parser.dotAll
			? everything()
			: fromRanges(
					[
						[10, 10],
						[13, 13],
					],
					true,
					true,
				);
		return { chars: set, nullable: false };
	}

	if (character === "\\") {
		let next = parser.source[parser.index + 1];
		if (next === "b" || next === "B") {
			parser.index += 2;
			return { chars: nothing(), nullable: true };
		}
		let set = escape(parser);
		return { chars: parser.ignoreCase ? foldCase(set) : set, nullable: false };
	}

	if (character === "*" || character === "+" || character === "?") {
		parser.unknown = true;
		return { chars: nothing(), nullable: true };
	}

	parser.index += 1;
	let set = nothing();
	addCode(set, character.charCodeAt(0));
	return { chars: parser.ignoreCase ? foldCase(set) : set, nullable: false };
}

/**
 * A parenthesized group. A lookaround consumes nothing, so it contributes no
 * characters and leaves the term nullable; its body is still parsed, to find
 * where it ends.
 */
function group(parser: Parser): Analysis {
	let rest = parser.source.slice(parser.index, parser.index + 4);
	let lookaround = /^\(\?(?:=|!|<=|<!)/.exec(rest);
	let named = /^\(\?<[A-Za-z_$][\w$]*>/.exec(parser.source.slice(parser.index, parser.index + 64));

	if (lookaround) parser.index += lookaround[0].length;
	else if (rest.startsWith("(?:")) parser.index += 3;
	else if (named) parser.index += named[0].length;
	else if (rest.startsWith("(?")) {
		parser.unknown = true;
		return { chars: nothing(), nullable: true };
	} else parser.index += 1;

	let inner = disjunction(parser);
	if (parser.source[parser.index] !== ")") {
		parser.unknown = true;
		return inner;
	}
	parser.index += 1;

	return lookaround ? { chars: nothing(), nullable: true } : inner;
}

/** A bracketed class, negated or not, with ranges and class escapes inside. */
function characterClass(parser: Parser): Analysis {
	parser.index += 1;
	let negate = parser.source[parser.index] === "^";
	if (negate) parser.index += 1;

	let set = nothing();

	while (parser.index < parser.source.length && parser.source[parser.index] !== "]") {
		let from = classAtom(parser);
		let isRange =
			parser.source[parser.index] === "-" &&
			parser.source[parser.index + 1] !== "]" &&
			parser.index + 1 < parser.source.length;

		if (typeof from === "number" && isRange) {
			parser.index += 1;
			let to = classAtom(parser);
			if (typeof to === "number") addRange(set, from, to);
			else {
				addCode(set, from);
				addCode(set, 45);
				union(set, to);
			}
		} else if (typeof from === "number") addCode(set, from);
		else union(set, from);
	}

	if (parser.source[parser.index] !== "]") {
		parser.unknown = true;
		return { chars: nothing(), nullable: false };
	}
	parser.index += 1;

	if (parser.ignoreCase) foldCase(set);
	if (negate) {
		for (let code = 0; code < ASCII; code++) set.ascii[code] = set.ascii[code] === 1 ? 0 : 1;
		set.other = true;
	}

	return { chars: set, nullable: false };
}

/** One member of a class: a code unit, or the set a class escape like `\d` stands for. */
function classAtom(parser: Parser): number | CharSet {
	let character = parser.source[parser.index] ?? "";
	if (character !== "\\") {
		parser.index += 1;
		return character.charCodeAt(0);
	}

	if (parser.source[parser.index + 1] === "b") {
		parser.index += 2;
		return 8;
	}

	let set = escape(parser);
	let members = set.ascii.reduce((count, flag) => count + flag, 0);
	if (!set.other && members === 1) return set.ascii.indexOf(1);
	return set;
}

/**
 * A backslash escape, outside a class or inside one. A code-unit escape
 * becomes that unit, a class escape its set, and an identity escape the
 * character itself; a backreference or a control escape marks the pattern as
 * one the analysis leaves to be always tried.
 */
function escape(parser: Parser): CharSet {
	let next = parser.source[parser.index + 1] ?? "";
	parser.index += 2;

	let set = nothing();
	let classes: Record<string, CharSet> = {
		d: fromRanges(DIGITS, false, false),
		D: fromRanges(DIGITS, true, true),
		w: fromRanges(WORD, false, false),
		W: fromRanges(WORD, true, true),
		s: fromRanges(SPACE, false, true),
		S: fromRanges(SPACE, true, true),
	};
	let simple: Record<string, number> = { n: 10, r: 13, t: 9, v: 11, f: 12 };

	let known = classes[next];
	if (known) return known;

	let code = simple[next];
	if (code !== undefined) {
		addCode(set, code);
		return set;
	}

	if (next === "x" || next === "u") {
		let digits = /^[\da-fA-F]+/.exec(
			parser.source.slice(parser.index, parser.index + (next === "x" ? 2 : 4)),
		);
		let length = next === "x" ? 2 : 4;
		if (digits && digits[0].length === length) {
			parser.index += length;
			addCode(set, Number.parseInt(digits[0], 16));
			return set;
		}
		addCode(set, next.charCodeAt(0));
		return set;
	}

	if (next === "0" && !/\d/.test(parser.source[parser.index] ?? "")) {
		addCode(set, 0);
		return set;
	}

	if (/[\dck]/.test(next)) {
		parser.unknown = true;
		return set;
	}

	addCode(set, next.charCodeAt(0));
	return set;
}
