/**
 * Reads YAML source over the subset this package supports, by walking the document
 * one line at a time. Scalars resolve by the YAML 1.2 core schema, so an ISO date
 * arrives as text and `yes` stays a string rather than becoming a boolean.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { YAMLParseError } from "./errors.js";
import { resolvePlain } from "./scalars.js";

/**
 * One source line, split into its indentation width and the text after it.
 */
interface Line {
	indent: number;
	content: string;
	number: number;
}

/**
 * A position in the line list, which parsing walks forward and never rewinds.
 *
 * A sequence entry rewrites the line it starts on into the node following its dash,
 * so one parser reads both `- title: a` and a mapping written on its own line.
 */
class Reader {
	#lines: Line[];
	#index = 0;

	/**
	 * Splits source text into lines, keeping each one's indentation width.
	 *
	 * @param source - YAML source text
	 */
	constructor(source: string) {
		let raws = source.split(/\r?\n/);

		/**
		 * A source ending in a line break splits into a final empty string that stands for
		 * no line, and counting it would hand a `+` chomped block one newline too many.
		 */
		if (raws.length > 1 && raws.at(-1) === "") raws.pop();

		this.#lines = raws.map((raw, index) => {
			let indent = 0;
			while (raw[indent] === " ") indent++;
			return { indent, content: raw.slice(indent), number: index + 1 };
		});
	}

	/**
	 * The line at the cursor, or `null` past the end of the source.
	 */
	get current(): Line | null {
		return this.#lines[this.#index] ?? null;
	}

	/**
	 * The line an error is reported against once the source runs out.
	 */
	get lastLineNumber(): number {
		return this.#lines.at(-1)?.number ?? 1;
	}

	/**
	 * Advances past the line at the cursor.
	 */
	advance(): void {
		this.#index++;
	}

	/**
	 * Reads the given line in place of the current one.
	 *
	 * @param line - The line to put at the cursor
	 */
	replace(line: Line): void {
		this.#lines[this.#index] = line;
	}

	/**
	 * Moves the cursor to the next line carrying a node, and returns it.
	 *
	 * Blank lines, comment lines and the `...` end marker are skipped, so `null`
	 * means the source holds no further nodes.
	 *
	 * @returns The next line to parse, or `null` at the end of the document
	 */
	seek(): Line | null {
		while (this.current) {
			let line = this.current;

			if (line.content.trim() === "" || line.content.startsWith("#")) {
				this.advance();
				continue;
			}

			if (line.content.startsWith("\t")) {
				throw new YAMLParseError("Tabs are not allowed as indentation", line.number);
			}

			if (line.indent > 0) return line;
			if (line.content.trimEnd() === "...") return null;

			if (line.content.startsWith("---")) {
				throw new YAMLParseError("Source must hold a single document", line.number);
			}

			if (line.content.startsWith("%")) {
				throw new YAMLParseError("Directives are not supported", line.number);
			}

			return line;
		}

		return null;
	}
}

/**
 * Parses YAML source into the value it describes.
 *
 * Block mappings and sequences, plain and quoted scalars, flow collections, literal
 * and folded block scalars, and comments are supported. Anchors, aliases, merge
 * keys, tags, explicit keys and multi-document sources are failures.
 *
 * @param source - YAML source text
 * @returns The value the source describes, or a failure when it falls outside the subset
 * @example
 * parse("title: Hello\norder: 1\n");
 */
export function parse(source: string): Result<unknown, YAMLParseError> {
	try {
		let reader = new Reader(source);
		let line = reader.seek();
		if (!line) return success(null);

		let value = parseNode(reader, line.indent);

		let extra = reader.seek();
		if (extra) {
			throw new YAMLParseError("Unexpected content after the document", extra.number);
		}

		return success(value);
	} catch (error) {
		if (error instanceof YAMLParseError) return failure(error);
		throw error;
	}
}

/**
 * Parses whichever node starts at the cursor: a sequence, a mapping, or a scalar.
 *
 * @param reader - Cursor positioned on the node's first line
 * @param indent - Indentation the node's lines share
 * @param boundary - Indentation a scalar's continuation lines must exceed, which a
 * sequence entry sets to its dash rather than to the text after it
 * @returns The parsed value
 */
function parseNode(reader: Reader, indent: number, boundary = indent): unknown {
	let line = reader.seek();
	if (!line) return null;

	if (isSequenceEntry(line.content)) return parseSequence(reader, indent);
	if (findKey(line.content, line.number)) return parseMapping(reader, indent);

	reader.advance();
	return parseValue(reader, line, line.content, boundary);
}

/**
 * Reads consecutive `key: value` lines sharing one indentation into an object.
 *
 * @param reader - Cursor positioned on the mapping's first line
 * @param indent - Indentation the mapping's keys share
 * @returns The parsed mapping
 */
function parseMapping(reader: Reader, indent: number): Record<string, unknown> {
	let mapping: Record<string, unknown> = {};

	for (let line = reader.seek(); line; line = reader.seek()) {
		if (line.indent < indent) break;
		if (line.indent > indent) {
			throw new YAMLParseError("Unexpected indentation", line.number);
		}

		let entry = findKey(line.content, line.number);
		if (!entry) throw new YAMLParseError("Expected a key", line.number);

		if (entry.key === "<<") {
			throw new YAMLParseError("Merge keys are not supported", line.number);
		}

		if (Object.hasOwn(mapping, entry.key)) {
			throw new YAMLParseError("Mapping keys must be unique", line.number);
		}

		reader.advance();

		/**
		 * Defined rather than assigned so a document naming `__proto__` as a key gets an
		 * own property, which is what assigning it would instead hand to the prototype.
		 */
		Object.defineProperty(mapping, entry.key, {
			value: parseValue(reader, line, entry.rest, indent),
			enumerable: true,
			writable: true,
			configurable: true,
		});
	}

	return mapping;
}

/**
 * Reads consecutive `- ` entries sharing one indentation into an array.
 *
 * @param reader - Cursor positioned on the sequence's first entry
 * @param indent - Indentation the entries' dashes share
 * @returns The parsed sequence
 */
function parseSequence(reader: Reader, indent: number): unknown[] {
	let sequence: unknown[] = [];

	for (let line = reader.seek(); line; line = reader.seek()) {
		if (line.indent < indent) break;
		if (line.indent > indent || !isSequenceEntry(line.content)) {
			throw new YAMLParseError("Unexpected indentation", line.number);
		}

		let rest = line.content.slice(1);
		let offset = rest.length - rest.trimStart().length;
		let entry = rest.trimStart();

		if (entry === "" || entry.startsWith("#")) {
			reader.advance();
			sequence.push(parseNestedNode(reader, indent));
			continue;
		}

		reader.replace({ indent: indent + 1 + offset, content: entry, number: line.number });
		sequence.push(parseNode(reader, indent + 1 + offset, indent));
	}

	return sequence;
}

/**
 * Parses the value a key introduces, on the key's own line or in the block under it.
 *
 * @param reader - Cursor positioned past the key's line
 * @param line - The line the key was read from
 * @param rest - Text following the key's colon, already trimmed
 * @param indent - Indentation of the key itself
 * @returns The parsed value
 */
function parseValue(reader: Reader, line: Line, rest: string, indent: number): unknown {
	if (rest === "" || rest.startsWith("#")) return parseIndentedNode(reader, indent);

	if (rest.startsWith("|") || rest.startsWith(">")) {
		return parseBlockScalar(reader, line, rest, indent);
	}

	rejectNodeProperty(rest, line.number);

	if (rest.startsWith("[") || rest.startsWith("{")) return parseFlow(reader, line, rest);
	if (rest.startsWith('"') || rest.startsWith("'")) return parseQuotedLine(rest, line.number);

	return parsePlain(reader, stripComment(rest), indent, line.number);
}

/**
 * Parses the node a key introduces without a value on its own line.
 *
 * A sequence is allowed to share the key's indentation, which is how YAML lets a
 * list sit flush against the key naming it.
 *
 * @param reader - Cursor positioned past the key's line
 * @param indent - Indentation of the key
 * @returns The parsed value, or `null` when no block follows
 */
function parseIndentedNode(reader: Reader, indent: number): unknown {
	let next = reader.seek();
	if (!next) return null;
	if (next.indent > indent) return parseNode(reader, next.indent);

	if (next.indent === indent && isSequenceEntry(next.content)) {
		return parseSequence(reader, indent);
	}

	return null;
}

/**
 * Parses the node indented under a sequence entry whose dash carries no value.
 *
 * @param reader - Cursor positioned past the dash's line
 * @param indent - Indentation of the dash
 * @returns The parsed value, or `null` when the entry is empty
 */
function parseNestedNode(reader: Reader, indent: number): unknown {
	let next = reader.seek();
	if (!next || next.indent <= indent) return null;
	return parseNode(reader, next.indent);
}

/**
 * Reads a literal (`|`) or folded (`>`) block scalar and applies its chomping.
 *
 * @param reader - Cursor positioned past the header's line
 * @param line - The line carrying the block scalar header
 * @param header - The header text, from its indicator to the end of the line
 * @param indent - Indentation of the key introducing the block
 * @returns The block's text
 */
function parseBlockScalar(reader: Reader, line: Line, header: string, indent: number): string {
	let match = /^([|>])(?:([-+])(\d)?|(\d)([-+])?)?[\t ]*(?:#.*)?$/.exec(header);
	if (!match) {
		throw new YAMLParseError("Unsupported block scalar header", line.number);
	}

	let folded = match[1] === ">";
	let chomp = match[2] ?? match[5];
	let width = match[3] ?? match[4];
	let collected: Line[] = [];
	let blockIndent = width ? indent + Number(width) : 0;

	while (reader.current) {
		let next = reader.current;
		let blank = next.content.trim() === "";
		if (!blank && next.indent <= indent) break;
		if (!blank && blockIndent === 0) blockIndent = next.indent;
		if (!blank && next.indent < blockIndent) break;
		collected.push(next);
		reader.advance();
	}

	let trailing = 0;
	while (collected.at(-1)?.content.trim() === "") {
		collected.pop();
		trailing++;
	}

	let lines = collected.map((entry) => {
		if (entry.content.trim() === "") return "";
		return " ".repeat(entry.indent - blockIndent) + entry.content;
	});

	let text = folded ? foldLines(lines) : lines.join("\n");
	if (chomp === "-") return text;
	if (chomp === "+") return text === "" ? "\n".repeat(trailing) : text + "\n".repeat(1 + trailing);

	return text === "" ? text : `${text}\n`;
}

/**
 * Joins a folded block's lines: blank lines become newlines, and a line indented
 * past the block keeps the breaks around it.
 *
 * @param lines - The block's lines, stripped of the block's own indentation
 * @returns The folded text
 */
function foldLines(lines: string[]): string {
	let text = "";
	let previous: string | null = null;
	let blanks = 0;

	for (let line of lines) {
		if (line === "") {
			blanks++;
			continue;
		}

		if (previous === null) text = line;
		else if (blanks > 0) text += "\n".repeat(blanks) + line;
		else if (line.startsWith(" ") || previous.startsWith(" ")) text += `\n${line}`;
		else text += ` ${line}`;

		previous = line;
		blanks = 0;
	}

	return text;
}

/**
 * Reads a plain scalar, folding the continuation lines indented under it.
 *
 * @param reader - Cursor positioned past the scalar's first line
 * @param first - The scalar's first line, stripped of its trailing comment
 * @param indent - Indentation of the key introducing the scalar
 * @param number - Line the scalar starts on
 * @returns The resolved scalar, or the folded text when it spans lines
 */
function parsePlain(reader: Reader, first: string, indent: number, number: number): unknown {
	let lines = [first.trimEnd()];
	let blanks = 0;

	while (reader.current) {
		let next = reader.current;

		if (next.content.trim() === "") {
			blanks++;
			reader.advance();
			continue;
		}

		if (next.indent <= indent) break;
		if (findKey(next.content, next.number)) {
			throw new YAMLParseError("Nested mappings are not allowed here", next.number);
		}

		lines.push("\n".repeat(blanks) + next.content.trimEnd());
		blanks = 0;
		reader.advance();
	}

	if (lines.length === 1) {
		let value = lines[0] ?? "";
		if (value.includes(": ") || value.endsWith(":")) {
			throw new YAMLParseError("Nested mappings are not allowed here", number);
		}

		return resolvePlain(value);
	}

	return lines.reduce((text, line) => (line.startsWith("\n") ? text + line : `${text} ${line}`));
}

/**
 * Reads a quoted scalar, which has to close on the line it opened.
 *
 * @param text - The line from the opening quote onward
 * @param number - The line's number
 * @returns The scalar's text
 */
function parseQuotedLine(text: string, number: number): string {
	let quoted = readQuoted(text, number);
	if (stripComment(text.slice(quoted.length)).trim() !== "") {
		throw new YAMLParseError("Unexpected content after a quoted value", number);
	}

	return quoted.value;
}

/**
 * Reads a flow collection, pulling in further lines until its brackets close.
 *
 * @param reader - Cursor positioned past the collection's first line
 * @param line - The line the collection opens on
 * @param first - The collection's text on that line
 * @returns The parsed array or object
 */
function parseFlow(reader: Reader, line: Line, first: string): unknown {
	let text = stripComment(first);

	while (!isBalanced(text)) {
		let next = reader.current;
		if (!next) {
			throw new YAMLParseError("Unterminated flow collection", reader.lastLineNumber);
		}

		reader.advance();
		text += ` ${stripComment(next.content.trim())}`;
	}

	let flow = readFlow(text, 0, line.number);
	if (text.slice(flow.length).trim() !== "") {
		throw new YAMLParseError("Unexpected content after a flow collection", line.number);
	}

	return flow.value;
}

/**
 * Reads one flow node — a collection or a scalar — starting at an offset.
 *
 * @param text - The joined flow text
 * @param start - Offset the node starts at
 * @param number - Line the collection opened on
 * @returns The node's value and how many characters it spans
 */
function readFlow(text: string, start: number, number: number): { value: unknown; length: number } {
	let index = skipSpaces(text, start);
	let open = text[index];

	if (open !== "[" && open !== "{") {
		if (open === '"' || open === "'") {
			let quoted = readQuoted(text.slice(index), number);
			return { value: quoted.value, length: index + quoted.length - start };
		}

		let end = index;
		while (end < text.length && !",]}".includes(text[end] ?? "")) end++;
		let raw = text.slice(index, end);

		rejectNodeProperty(raw, number);
		let plain = raw.trim();
		if (plain.includes(": ")) {
			throw new YAMLParseError("Nested mappings are not allowed here", number);
		}

		return { value: resolvePlain(plain), length: end - start };
	}

	let close = open === "[" ? "]" : "}";
	let items: unknown[] = [];
	let mapping: Record<string, unknown> = {};
	index++;

	while (true) {
		index = skipSpaces(text, index);
		if (index >= text.length) {
			throw new YAMLParseError("Unterminated flow collection", number);
		}

		if (text[index] === close) {
			index++;
			break;
		}

		if (open === "[") {
			if (text[skipSpaces(text, index)] === ",") {
				throw new YAMLParseError("Expected a value in a flow sequence", number);
			}

			let item = readFlow(text, index, number);
			items.push(item.value);
			index += item.length;
		} else {
			let entry = readFlowEntry(text, index, number, close);
			mapping[entry.key] = entry.value;
			index += entry.length;
		}

		index = skipSpaces(text, index);
		if (text[index] === ",") index++;
		else if (text[index] !== close) {
			throw new YAMLParseError("Expected a comma in a flow collection", number);
		}
	}

	return { value: open === "[" ? items : mapping, length: index - start };
}

/**
 * Reads one `key: value` pair inside a flow mapping.
 *
 * @param text - The joined flow text
 * @param start - Offset the pair starts at
 * @param number - Line the collection opened on
 * @param close - The bracket closing the mapping
 * @returns The pair and how many characters it spans
 */
function readFlowEntry(
	text: string,
	start: number,
	number: number,
	close: string,
): { key: string; value: unknown; length: number } {
	let index = skipSpaces(text, start);
	let key: string;

	if (text[index] === '"' || text[index] === "'") {
		let quoted = readQuoted(text.slice(index), number);
		key = quoted.value;
		index += quoted.length;
	} else {
		let end = index;
		while (end < text.length && !`:,${close}`.includes(text[end] ?? "")) end++;
		key = text.slice(index, end).trim();
		index = end;
	}

	index = skipSpaces(text, index);
	if (text[index] !== ":") {
		throw new YAMLParseError("Expected a colon in a flow mapping", number);
	}

	let value = readFlow(text, index + 1, number);
	return { key, value: value.value, length: index + 1 + value.length - start };
}

/**
 * Reads a single- or double-quoted scalar from the start of a string.
 *
 * @param text - Text beginning with the opening quote
 * @param number - The line's number
 * @returns The scalar's text and how many characters it spans
 */
function readQuoted(text: string, number: number): { value: string; length: number } {
	let quote = text[0];
	let value = "";
	let index = 1;

	while (index < text.length) {
		let char = text[index];

		if (char === quote) {
			if (quote === "'" && text[index + 1] === "'") {
				value += "'";
				index += 2;
				continue;
			}

			return { value, length: index + 1 };
		}

		if (quote === '"' && char === "\\") {
			let escape = readEscape(text, index, number);
			value += escape.value;
			index += escape.length;
			continue;
		}

		value += char;
		index++;
	}

	throw new YAMLParseError("A quoted value must close on the line it opens", number);
}

/**
 * The characters a double-quoted escape stands for, beyond the numeric forms.
 */
const ESCAPES: Record<string, string> = {
	"0": "\u0000",
	a: "\u0007",
	b: "\b",
	t: "\t",
	"\t": "\t",
	n: "\n",
	v: "\v",
	f: "\f",
	r: "\r",
	e: "\u001B",
	" ": " ",
	'"': '"',
	"/": "/",
	"\\": "\\",
	N: "\u0085",
	_: "\u00A0",
	L: "\u2028",
	P: "\u2029",
};

/**
 * How many hexadecimal digits each numeric escape takes.
 */
const ESCAPE_WIDTHS: Record<string, number> = { x: 2, u: 4, U: 8 };

/**
 * Reads one escape sequence inside a double-quoted scalar.
 *
 * @param text - The scalar's text
 * @param index - Offset of the backslash
 * @param number - The line's number
 * @returns The character it stands for and how many characters it spans
 */
function readEscape(
	text: string,
	index: number,
	number: number,
): { value: string; length: number } {
	let marker = text[index + 1] ?? "";
	let width = ESCAPE_WIDTHS[marker];

	if (width) {
		let digits = text.slice(index + 2, index + 2 + width);
		if (!new RegExp(`^[\\dA-Fa-f]{${width}}$`).test(digits)) {
			throw new YAMLParseError("Invalid escape sequence", number);
		}

		return { value: String.fromCodePoint(Number.parseInt(digits, 16)), length: 2 + width };
	}

	let value = ESCAPES[marker];
	if (value === undefined) throw new YAMLParseError("Invalid escape sequence", number);

	return { value, length: 2 };
}

/**
 * Splits a line into its key and the text following the colon.
 *
 * @param content - The line's text, without its indentation
 * @param number - The line's number
 * @returns The key and the rest of the line, or `null` when the line holds no key
 */
function findKey(content: string, number: number): { key: string; rest: string } | null {
	if (content.startsWith("? ") || content.trimEnd() === "?") {
		throw new YAMLParseError("Explicit keys are not supported", number);
	}

	if (content.startsWith('"') || content.startsWith("'")) {
		let quoted = readQuoted(content, number);
		let after = content.slice(quoted.length);
		if (!after.startsWith(":")) return null;
		return { key: quoted.value, rest: after.slice(1).trim() };
	}

	if (content.startsWith("[") || content.startsWith("{")) return null;

	for (let index = 0; index < content.length; index++) {
		if (content[index] !== ":") continue;
		let next = content[index + 1];
		if (next !== undefined && next !== " ") continue;
		return { key: content.slice(0, index).trimEnd(), rest: content.slice(index + 1).trim() };
	}

	return null;
}

/**
 * Rejects the node properties and reserved indicators a plain scalar may not open
 * with, which would otherwise be read as ordinary text.
 *
 * @param text - A node's text, from its first character
 * @param number - The line's number
 */
function rejectNodeProperty(text: string, number: number): void {
	let value = text.trimStart();
	let marker = value[0];

	if (marker === "&" || marker === "*") {
		throw new YAMLParseError("Anchors and aliases are not supported", number);
	}

	if (marker === "!") throw new YAMLParseError("Tags are not supported", number);

	if (marker !== undefined && "@`,]}%".includes(marker)) {
		throw new YAMLParseError("A value may not start with a reserved character", number);
	}

	if (value.trimEnd() === "-") {
		throw new YAMLParseError("A value may not start with a reserved character", number);
	}
}

/**
 * Whether a line opens a sequence entry.
 *
 * @param content - The line's text, without its indentation
 * @returns `true` when the line starts with a dash introducing an entry
 */
function isSequenceEntry(content: string): boolean {
	return content === "-" || content.startsWith("- ");
}

/**
 * Drops a trailing comment, keeping a `#` that sits inside a value.
 *
 * @param text - A line's text
 * @returns The text up to the comment
 */
function stripComment(text: string): string {
	let quote: string | null = null;

	for (let index = 0; index < text.length; index++) {
		let char = text[index];

		if (quote) {
			if (char === quote) quote = null;
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}

		if (char === "#" && (index === 0 || text[index - 1] === " ")) return text.slice(0, index);
	}

	return text;
}

/**
 * Whether a flow collection's brackets close within the text read so far.
 *
 * @param text - The flow text gathered up to now
 * @returns `true` once every bracket opened has closed
 */
function isBalanced(text: string): boolean {
	let depth = 0;
	let quote: string | null = null;

	for (let char of text) {
		if (quote) {
			if (char === quote) quote = null;
			continue;
		}

		if (char === '"' || char === "'") quote = char;
		else if (char === "[" || char === "{") depth++;
		else if (char === "]" || char === "}") depth--;
	}

	return depth <= 0;
}

/**
 * Advances past spaces and tabs.
 *
 * @param text - The text being read
 * @param start - Offset to start from
 * @returns Offset of the first character that is neither a space nor a tab
 */
function skipSpaces(text: string, start: number): number {
	let index = start;
	while (text[index] === " " || text[index] === "\t") index++;
	return index;
}
