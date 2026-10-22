/**
 * The structure every edit reads over the tokens: matched brackets, nesting depth, calls to a
 * named callee, their arguments, and where a statement ends. Also the text helpers that keep an
 * insertion in the indentation, quote and line layout of the code around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { CodemodError } from "./errors.js";
import type { Token } from "./tokenize.js";

import { languageOf, tokenize } from "./tokenize.js";

/**
 * A scanned file. `code` holds the tokens that are code (no comments, no JSX markup), and
 * `match` and `depth` are indexed like it: `match[i]` is the index of the bracket pairing
 * with `code[i]`, or -1, and `depth[i]` counts the brackets open around `code[i]`.
 */
export interface Structure {
	filename: string;
	source: string;
	typescript: boolean;
	tokens: Token[];
	code: Token[];
	match: number[];
	depth: number[];
}

/** One call to a named callee, as indices into {@link Structure.code}. */
export interface Call {
	/** The first token of the callee. */
	callee: number;
	open: number;
	close: number;
}

/** One argument of a call or one element between commas, as a half-open `code` index range. */
export interface Span {
	start: number;
	end: number;
}

/**
 * Tokens that, ending one line, let the next line start a new statement under automatic
 * semicolon insertion.
 */
const CONTINUING_IDENTIFIERS = new Set(["as", "satisfies", "in", "instanceof", "of"]);

/** Scans `source` and pairs its brackets. */
export function analyze(filename: string, source: string): Result<Structure, CodemodError> {
	let tokens = tokenize(filename, source);
	if (isFailure(tokens)) return tokens;
	let code = tokens.data.filter((token) => token.type !== "comment" && token.type !== "jsx");
	let match: number[] = Array.from({ length: code.length }, () => -1);
	let depth: number[] = Array.from({ length: code.length }, () => 0);
	let open: number[] = [];
	for (let [index, token] of code.entries()) {
		let closes =
			token.type === "template-tail" ||
			token.type === "template-middle" ||
			(token.type === "punctuator" &&
				(token.value === ")" || token.value === "]" || token.value === "}"));
		if (closes) {
			let opener = open.pop() ?? -1;
			if (opener !== -1) {
				match[opener] = index;
				match[index] = opener;
			}
		}
		depth[index] = open.length;
		let opens =
			token.type === "template-head" ||
			token.type === "template-middle" ||
			(token.type === "punctuator" &&
				(token.value === "(" || token.value === "[" || token.value === "{"));
		if (opens) open.push(index);
	}
	return success({
		filename,
		source,
		typescript: languageOf(filename)?.typescript ?? false,
		tokens: tokens.data,
		code,
		match,
		depth,
	});
}

/** Whether `token` is the punctuator `value`. */
export function isPunctuator(token: Token | undefined, value: string): boolean {
	return token !== undefined && token.type === "punctuator" && token.value === value;
}

/** Whether `token` is an identifier, or the identifier `value` when one is given. */
export function isIdentifier(token: Token | undefined, value?: string): boolean {
	return (
		token !== undefined &&
		token.type === "identifier" &&
		(value === undefined || token.value === value)
	);
}

/** Whether `code[index]` follows `.` or `?.`, so it names a property rather than a binding. */
export function isMember(structure: Structure, index: number): boolean {
	let previous = structure.code[index - 1];
	return isPunctuator(previous, ".") || isPunctuator(previous, "?.");
}

/**
 * Every call whose callee is the dotted path `callee` (`jobs`, `router.map`, `vi.mock`), in
 * source order. A callee reached through a longer path (`a.router.map`) is a different callee;
 * TypeScript type arguments between the callee and `(` are skipped.
 */
export function findCalls(structure: Structure, callee: string): Call[] {
	let parts = callee.split(".");
	let code = structure.code;
	let calls: Call[] = [];
	for (let index = 0; index < code.length; index += 1) {
		if (!isIdentifier(code[index], parts[0]) || isMember(structure, index)) continue;
		let at = index + 1;
		let matched = true;
		for (let part of parts.slice(1)) {
			if (!isPunctuator(code[at], ".") || !isIdentifier(code[at + 1], part)) {
				matched = false;
				break;
			}
			at += 2;
		}
		if (!matched) continue;
		if (structure.typescript && isPunctuator(code[at], "<")) at = typeArgumentsEnd(structure, at);
		if (at === -1 || !isPunctuator(code[at], "(")) continue;
		calls.push({ callee: index, open: at, close: structure.match[at] ?? -1 });
	}
	return calls;
}

/** The index after the `>` that closes the type arguments opening at `open`, or -1. */
function typeArgumentsEnd(structure: Structure, open: number): number {
	let level = 0;
	let code = structure.code;
	for (let index = open; index < code.length; index += 1) {
		let token = code[index];
		if (isPunctuator(token, "<")) level += 1;
		else if (isPunctuator(token, ">")) {
			level -= 1;
			if (level === 0) return index + 1;
		} else if (isPunctuator(token, "(") || isPunctuator(token, "[") || isPunctuator(token, "{")) {
			index = structure.match[index] ?? index;
		} else if (token?.type === "punctuator" && (token.value === ";" || token.value === ")")) {
			return -1;
		}
	}
	return -1;
}

/**
 * The comma-separated elements between the bracket at `open` and its match: arguments of a
 * call, properties of an object literal, names of an import list. A trailing comma adds no
 * element.
 */
export function elements(structure: Structure, open: number): Span[] {
	let close = structure.match[open] ?? -1;
	let spans: Span[] = [];
	let start = open + 1;
	for (let index = open + 1; index < close; index += 1) {
		let token = structure.code[index];
		if (isPunctuator(token, ",")) {
			spans.push({ start, end: index });
			start = index + 1;
		} else {
			index = Math.max(index, closingOf(structure, index));
		}
	}
	if (start < close) spans.push({ start, end: close });
	return spans;
}

/**
 * The index of the bracket that closes the one opening at `code[index]`, or -1 when `code[index]`
 * opens nothing. A template literal's head closes at its tail, past every substitution.
 */
export function closingOf(structure: Structure, index: number): number {
	let token = structure.code[index];
	if (token === undefined) return -1;
	let opens =
		token.type === "template-head" ||
		(token.type === "punctuator" &&
			(token.value === "(" || token.value === "[" || token.value === "{"));
	if (!opens) return -1;
	let closing = structure.match[index] ?? -1;
	while (structure.code[closing]?.type === "template-middle")
		closing = structure.match[closing] ?? -1;
	return closing;
}

/** Whether a new statement may begin at `code[index]`. */
export function startsStatement(structure: Structure, index: number): boolean {
	let previous = structure.code[index - 1];
	if (previous === undefined) return true;
	if (isPunctuator(previous, ";") || isPunctuator(previous, "{") || isPunctuator(previous, "}")) {
		return true;
	}
	return structure.code[index]?.newlineBefore === true && endsExpression(previous);
}

/**
 * The index of the last token of the statement that starts at or contains `code[index]`: the
 * `;` that ends it, or under automatic semicolon insertion the token before a line that
 * starts a new statement, or the token before the `}` closing the enclosing block.
 */
export function statementEnd(structure: Structure, index: number): number {
	let code = structure.code;
	let level = structure.depth[index] ?? 0;
	let last = index;
	for (let at = index; at < code.length; at += 1) {
		let token = code[at]!;
		if ((structure.depth[at] ?? 0) < level) return last;
		if (at > index && token.newlineBefore && endsExpression(code[last]!) && !continues(token)) {
			return last;
		}
		if (isPunctuator(token, ";")) return at;
		last = Math.max(at, closingOf(structure, at));
		at = last;
	}
	return last;
}

/** Whether `token` can end an expression, so a line break after it may end the statement. */
function endsExpression(token: Token): boolean {
	if (token.type === "punctuator") {
		return [")", "]", "}", "++", "--"].includes(token.value);
	}
	return token.type !== "template-head" && token.type !== "template-middle";
}

/** Whether `token`, starting a line, continues the expression on the line before. */
function continues(token: Token): boolean {
	if (token.type === "punctuator") {
		return !["{", "++", "--", "!", "~", "@", "#"].includes(token.value);
	}
	if (token.type === "template" || token.type === "template-head") return true;
	return token.type === "identifier" && CONTINUING_IDENTIFIERS.has(token.value);
}

/** The offset where the line holding `offset` starts. */
export function lineStart(source: string, offset: number): number {
	return source.lastIndexOf("\n", offset - 1) + 1;
}

/** The whitespace that indents the line holding `offset`. */
export function lineIndent(source: string, offset: number): string {
	let start = lineStart(source, offset);
	return /^[ \t]*/.exec(source.slice(start, offset))?.[0] ?? "";
}

/** Whether a line break separates `from` and `to`. */
export function crossesLine(source: string, from: number, to: number): boolean {
	return source.slice(from, to).includes("\n");
}

/**
 * Where to insert after `offset` so the inserted lines follow any comment that shares the line:
 * the end of the line when only whitespace and comments follow, `offset` otherwise.
 */
export function afterLine(source: string, offset: number): number {
	let at = offset;
	while (at < source.length) {
		let char = source[at];
		if (char === "\n" || char === "\r") return at;
		if (char === " " || char === "\t") {
			at += 1;
		} else if (source.startsWith("//", at)) {
			let end = source.indexOf("\n", at);
			if (end === -1) return source.length;
			if (source[end - 1] === "\r") return end - 1;
			return end;
		} else if (source.startsWith("/*", at)) {
			let end = source.indexOf("*/", at);
			if (end === -1 || source.slice(at, end).includes("\n")) return offset;
			at = end + 2;
		} else {
			return offset;
		}
	}
	return at;
}

/** The line break the source uses, `\r\n` when its first line ends with one. */
export function lineBreak(source: string): string {
	let first = source.indexOf("\n");
	return first > 0 && source[first - 1] === "\r" ? "\r\n" : "\n";
}

/**
 * One level of indentation as the source writes it: a tab when any line is indented with
 * one, otherwise the narrowest space indent of a code line, otherwise a tab.
 */
export function indentUnit(source: string): string {
	let narrowest = Number.POSITIVE_INFINITY;
	for (let line of source.split("\n")) {
		if (line.startsWith("\t")) return "\t";
		let spaces = /^( +)(\S)/.exec(line);
		if (spaces !== null && spaces[2] !== "*" && spaces[1]!.length < narrowest) {
			narrowest = spaces[1]!.length;
		}
	}
	return Number.isFinite(narrowest) ? " ".repeat(narrowest) : "\t";
}

/** `text` with `indent` added before every line after the first that is not blank. */
export function reindent(text: string, indent: string, newline = "\n"): string {
	return text
		.split(/\r?\n/)
		.map((line, index) => (index === 0 || line.trim() === "" ? line : indent + line))
		.join(newline);
}

/** The quote character of the first string literal in the file, `"` when there is none. */
export function preferredQuote(structure: Structure): string {
	let first = structure.code.find((token) => token.type === "string");
	return first?.value[0] ?? '"';
}

/** The characters single-letter escapes stand for. */
const ESCAPES: Record<string, string> = {
	n: "\n",
	r: "\r",
	t: "\t",
	b: "\b",
	f: "\f",
	v: "\v",
	"0": "\0",
};

/** The value of a string literal token, escapes resolved. */
export function cook(raw: string): string {
	let body = raw.slice(1, -1);
	if (!body.includes("\\")) return body;
	return body.replace(
		/\\(u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|\r\n|[\s\S])/g,
		(_, escape: string, braced?: string, unicode?: string, hex?: string) => {
			let code = braced ?? unicode ?? hex;
			if (code !== undefined) return String.fromCodePoint(Number.parseInt(code, 16));
			return ESCAPES[escape] ?? (escape === "\r\n" || escape === "\n" ? "" : escape);
		},
	);
}

/** `value` as a string literal in `quoteCharacter`, escaping only what the literal requires. */
export function quote(value: string, quoteCharacter: string): string {
	let escaped = value
		.replaceAll("\\", "\\\\")
		.replaceAll(quoteCharacter, `\\${quoteCharacter}`)
		.replaceAll("\n", "\\n")
		.replaceAll("\r", "\\r");
	return `${quoteCharacter}${escaped}${quoteCharacter}`;
}
