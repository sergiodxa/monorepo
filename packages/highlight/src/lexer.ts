/**
 * The token model every grammar produces and the scanner that produces it: a
 * single left-to-right pass that tries the current mode's rules that can start
 * at the cursor's character, and takes the first one that matches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Dispatch } from "./dispatch.js";

import { dispatchFor } from "./dispatch.js";

export namespace Token {
	/**
	 * Every kind of run a grammar can name. The set is closed so a palette that
	 * maps over it is exhaustive, and small enough that a stylesheet paints all of
	 * it: a grammar picks the nearest member rather than introducing its own.
	 *
	 * - `keyword` — reserved words, CSS at-rules, a shell's builtin verbs
	 * - `builtin` — names the language itself provides, like TypeScript's `string`
	 * - `class-name` — types, classes, and the names of both where they are declared
	 * - `function` — a name in the position of something called or defined
	 * - `property` — a key: an object literal's, a CSS declaration's, a mapping's
	 * - `tag` — a markup tag name, and a CSS selector
	 * - `attr-name`, `attr-value` — the halves of a markup attribute
	 * - `constant` — `SCREAMING_CASE` names, and a language's named constants
	 * - `variable` — a sigil-marked name, such as a shell's `$name`
	 * - `inserted`, `deleted` — the two sides of a diff
	 * - `plain` — everything no rule claimed
	 */
	export type Type =
		| "attr-name"
		| "attr-value"
		| "boolean"
		| "builtin"
		| "class-name"
		| "comment"
		| "constant"
		| "deleted"
		| "function"
		| "inserted"
		| "keyword"
		| "number"
		| "operator"
		| "plain"
		| "property"
		| "punctuation"
		| "regex"
		| "string"
		| "tag"
		| "variable";
}

/**
 * One run of source, and what to paint it as.
 */
export interface Token {
	type: Token.Type;
	value: string;
}

/**
 * One thing a grammar knows how to recognize at the cursor.
 *
 * `match` has to carry the sticky flag, so it can only ever match where the
 * scanner is rather than searching ahead, and it has to match at least one
 * character. `push` and `pop` move the mode stack, and a rule uses one or the
 * other.
 */
export interface Rule {
	type: Token.Type;
	match: RegExp;
	push?: string;
	pop?: true;
}

/**
 * A language, as its modes.
 */
export interface Grammar {
	/** Where scanning starts. */
	main: Rule[];
	/**
	 * A context a rule pushes onto the stack: a template literal's interpolation,
	 * a markup tag's attributes, the body of an embedded language.
	 */
	[mode: string]: Rule[];
}

/**
 * Merges grammars into one, mode by mode, so a language built on another states
 * that as an import: the earlier grammar's rules are tried first, which is how a
 * JSX tag wins over a TypeScript comparison on the same `<`.
 *
 * A part with no `main` of its own is merged the same way, which is how a set of
 * modes lifted off another grammar joins one.
 *
 * @param parts - The grammars and mode sets to merge, in priority order
 * @returns A grammar holding every mode any of them defines
 */
export function compose(...parts: Array<Record<string, Rule[]>>): Grammar {
	let merged: Record<string, Rule[]> = {};

	for (let part of parts) {
		for (let [mode, rules] of Object.entries(part)) {
			merged[mode] = [...(merged[mode] ?? []), ...rules];
		}
	}

	return { main: [], ...merged };
}

export namespace Line {
	/**
	 * The mode stack where a line ends, innermost mode last: what a scan of the
	 * line after it starts from. It is frozen, and lines that end in the same
	 * modes share one array.
	 */
	export type State = readonly string[];
}

/**
 * One line of source as tokens, and the modes the scanner was in when it
 * crossed the line's newline.
 */
export interface Line {
	/** The line's runs, without its newline; an empty line has none. */
	tokens: Token[];
	state: Line.State;
}

/**
 * How a scan runs. Both fields are optional, and the defaults reproduce the
 * tokens of an ordinary file exactly.
 */
export interface ScanOptions {
	/**
	 * How many characters of a line the grammar reads. The rest of a longer line,
	 * up to its newline, is one `plain` run, so a minified file paints at once;
	 * the next line is read normally. `Infinity` reads every line in full.
	 *
	 * @default 2000
	 */
	maxLineLength?: number;
	/**
	 * The mode stack to start in, as a {@link Line}'s `state` left it, so a chunk
	 * of a file scans on its own from where the line before it ended.
	 *
	 * @default ["main"]
	 */
	state?: Line.State;
}

/** The tokens of a scan, and the state at each newline followed by the state at the end. */
interface Scanned {
	tokens: Token[];
	states: Line.State[];
}

const DEFAULT_MAX_LINE_LENGTH = 2_000;
const INITIAL_STATE: Line.State = Object.freeze(["main"]);
const NO_RULES: Rule[] = [];

/**
 * Scans source into tokens with a grammar. At each position only the rules
 * that can start with the character there are tried, in the mode's order, and
 * a run of characters none of them can start is `plain` in one step.
 *
 * Adjacent runs of the same type arrive merged, so the output is the same
 * whether a grammar spells a construct as one rule or several.
 *
 * @param code - Source to scan
 * @param grammar - The language to scan it as
 * @param options - The line length cap and the state to start in
 * @returns The tokens, in source order, covering the input exactly once
 */
export function scan(code: string, grammar: Grammar, options: ScanOptions = {}): Token[] {
	return run(code, grammar, options, false).tokens;
}

/**
 * Scans source into lines of tokens, each with the mode stack it ends in.
 *
 * A line's `state` passed back as `options.state` resumes the scan at the next
 * line, so a range of a file — a diff hunk, more context around it — scans
 * without the lines above it. A pattern that looks behind the start of the
 * chunk sees nothing there, so a key on the first line after a `{` may paint
 * as plain text.
 *
 * @param code - Source to scan
 * @param grammar - The language to scan it as
 * @param options - The line length cap and the state to start in
 * @returns One entry per line: a source with `n` newlines has `n + 1`
 * @example let lines = scanLines(file, typescript); scanLines(hunk, typescript, { state: lines[41]?.state })
 */
export function scanLines(code: string, grammar: Grammar, options: ScanOptions = {}): Line[] {
	let { tokens, states } = run(code, grammar, options, true);
	let lines: Line[] = [];
	let current: Token[] = [];

	for (let token of tokens) {
		let from = 0;
		let newline = token.value.indexOf("\n");

		while (newline !== -1) {
			if (newline > from)
				current.push({ type: token.type, value: token.value.slice(from, newline) });
			lines.push({ tokens: current, state: states[lines.length] ?? INITIAL_STATE });
			current = [];
			from = newline + 1;
			newline = token.value.indexOf("\n", from);
		}

		if (from === 0) current.push(token);
		else if (from < token.value.length)
			current.push({ type: token.type, value: token.value.slice(from) });
	}

	lines.push({ tokens: current, state: states[lines.length] ?? INITIAL_STATE });
	return lines;
}

/**
 * The scan both entry points share. Newlines are followed only when a state is
 * wanted at each one or some line can reach the length cap, so a short input
 * pays for neither.
 */
function run(code: string, grammar: Grammar, options: ScanOptions, trackStates: boolean): Scanned {
	let maxLineLength = options.maxLineLength ?? DEFAULT_MAX_LINE_LENGTH;
	let modes = options.state && options.state.length > 0 ? [...options.state] : [...INITIAL_STATE];
	let length = code.length;
	let tracking = trackStates || length > maxLineLength;

	let tokens: Token[] = [];
	let states: Line.State[] = [];
	let snapshot: Line.State | undefined;
	let dispatch = dispatchOf(grammar, modes);

	let type: Token.Type | undefined;
	let start = 0;
	let position = 0;
	let lineStart = 0;
	let nextNewline = tracking ? newlineFrom(code, 0) : length;

	/** Claims the source up to `end` as a run of `next`, extending the open run when it shares the type. */
	function emit(next: Token.Type, end: number) {
		if (type !== next) {
			if (type !== undefined) tokens.push({ type, value: code.slice(start, position) });
			type = next;
			start = position;
		}
		position = end;
	}

	/** Records the state at each newline before `limit` and moves the line start past it. */
	function crossNewlines(limit: number) {
		while (nextNewline < limit) {
			if (trackStates) {
				snapshot ??= Object.freeze([...modes]);
				states.push(snapshot);
			}
			lineStart = nextNewline + 1;
			nextNewline = newlineFrom(code, lineStart);
		}
	}

	while (position < length) {
		if (position - lineStart >= maxLineLength && position < nextNewline) {
			emit("plain", nextNewline);
			continue;
		}

		let character = code.charCodeAt(position);
		let candidates = character < 128 ? (dispatch.ascii[character] ?? NO_RULES) : dispatch.other;

		if (candidates.length === 0) {
			let end = plainRunEnd(code, position + 1, dispatch);
			crossNewlines(end);
			emit("plain", end);
			continue;
		}

		let rule = matchAt(code, position, candidates);

		if (!rule) {
			crossNewlines(position + 1);
			emit("plain", position + 1);
			continue;
		}

		let end = rule.match.lastIndex;
		crossNewlines(end - 1);
		emit(rule.type, end);

		if (rule.push || (rule.pop && modes.length > 1)) {
			if (rule.push) modes.push(rule.push);
			else modes.pop();
			snapshot = undefined;
			dispatch = dispatchOf(grammar, modes);
		}

		crossNewlines(end);
	}

	if (type !== undefined) tokens.push({ type, value: code.slice(start, position) });
	if (trackStates) states.push(snapshot ?? Object.freeze([...modes]));

	return { tokens, states };
}

/** The dispatch table of the mode on top of the stack; a mode the grammar lacks has no rules. */
function dispatchOf(grammar: Grammar, modes: string[]): Dispatch {
	return dispatchFor(grammar[modes.at(-1) ?? "main"] ?? NO_RULES);
}

/** The index of the next newline at or after `from`, or the length of the source when none follows. */
function newlineFrom(code: string, from: number): number {
	let index = code.indexOf("\n", from);
	return index === -1 ? code.length : index;
}

/** Where a run of characters no rule of the mode can start ends. */
function plainRunEnd(code: string, from: number, dispatch: Dispatch): number {
	let end = from;
	while (end < code.length) {
		let character = code.charCodeAt(end);
		if (character < 128 ? dispatch.plain[character] === 0 : !dispatch.otherPlain) break;
		end += 1;
	}
	return end;
}

/**
 * Finds the first candidate that matches at least one character at a position,
 * leaving its pattern's `lastIndex` at the end of the match.
 */
function matchAt(code: string, position: number, candidates: Rule[]): Rule | undefined {
	for (let rule of candidates) {
		rule.match.lastIndex = position;
		if (rule.match.test(code) && rule.match.lastIndex > position) return rule;
	}

	return undefined;
}
