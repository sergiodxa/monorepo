/**
 * The second phase of the reference strategy: the delimiter stack over one leaf
 * block's text, producing emphasis, links, code spans, and this dialect's inline
 * tags and variables. Every node's position maps back through the leaf's chunks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Markdown } from "../index.js";

import type { TagOpen } from "./attributes.js";
import type { Cell } from "./inline/cells.js";
import type { ResolvedOptions, ResolvedTag } from "./options.js";
import type { SourceText } from "./source.js";

import {
	parseAttributeList,
	readVariableName,
	scanAnnotation,
	scanTagClose,
	scanTagOpen,
} from "./attributes.js";
import { decodeEntity } from "./entities.js";
import { MarkdownParseError } from "./errors.js";
import { Cells } from "./inline/cells.js";
import {
	isEscapable,
	matchAutolink,
	matchDestination,
	matchHtmlTag,
	matchLabel,
	matchLiteralEmail,
	matchLiteralUrl,
	matchTitle,
	normalizeIdentifier,
	normalizeLabel,
	scanDelimiterRun,
	skipSpaceAndNewline,
} from "./inline/scan.js";

export { normalizeLabel } from "./inline/scan.js";

/** Nothing went wrong, which is most of what the character handlers have to say. */
const OK = success(undefined);

/** The characters that end a run of ordinary text, whether or not they turn out to begin a node. */
const SPECIAL = /[\n\\`[\]!<&*_~{@fFwWhH]/;

/** The letters a literal autolink may begin with, being its scheme's or its bare host's first one. */
const URL_START = /[fhw]/i;

/** The name an element opens with, which decides whether a `<` is worth scanning as a tag. */
const TAG_NAME = /[A-Za-z_][A-Za-z0-9_-]*/y;

/** Spaces a hard or soft break leaves behind at the end of its line. */
const FINAL_SPACES = / *$/;

/** Spaces the next line opens with, which a break swallows so the text reads continuous. */
const INITIAL_SPACES = /^ */;

/** Spaces the leaf's last line trails, which belong to no node a reader can see. */
const TRAILING_BLANKS = /[ \t]*$/;

/** A run of backticks, which opens a code span and has to be closed by a run of the same length. */
const BACKTICKS = /`+/y;

/** A link reference definition the block phase consumed, ready for a reference to resolve against. */
export interface Reference {
	href: string;
	title?: string;
}

/** What the inline phase needs from the document around the leaf it is reading. */
export interface InlineContext {
	/** Definitions keyed by their normalized label, as CommonMark normalizes it. */
	references: Map<string, Reference>;
	options: ResolvedOptions;
}

/**
 * Reads one leaf block's text into inline nodes.
 *
 * @param text - The leaf's collected lines, carrying their source coordinates
 * @param context - The document's reference definitions and registered tags
 * @returns The inline nodes, or the first thing the phase could not read
 */
export function parseInlines(
	text: SourceText,
	context: InlineContext,
): Result<Markdown.Inline[], Markdown.ParseError> {
	let blanks = TRAILING_BLANKS.exec(text.value)?.[0].length ?? 0;

	return new InlineRun(text, context, 0, text.value.length - blanks).run();
}

/** One delimiter run on the stack, with the flanking answers the algorithm reads back. */
interface Delimiter {
	char: string;
	/** How many delimiters are still unused, which emphasis spends from either end. */
	length: number;
	/** How many the source wrote, which is what the rule of three reads. */
	original: number;
	/** Where the run begins, which orders the stack even after a span has taken runs out of it. */
	index: number;
	cell: Cell;
	canOpen: boolean;
	canClose: boolean;
	previous: Delimiter | null;
	next: Delimiter | null;
}

/** One unmatched `[` or `![`, with the state a later `]` needs to decide what it closes. */
interface Bracket {
	cell: Cell;
	/** Index of the `[`, which is where a shortcut reference's label begins. */
	index: number;
	image: boolean;
	/** Whether a link has since claimed this bracket, which is what keeps links from nesting. */
	active: boolean;
	/** Whether another bracket opened after this one, which rules out the shortcut form. */
	bracketAfter: boolean;
	previous: Bracket | null;
	/** The nearest enclosing `[`, which is the only kind a link reaching over it deactivates. */
	previousLink: Bracket | null;
	previousDelimiter: Delimiter | null;
}

/**
 * Finds the closing tag that matches an opener, counting same-named openers so a
 * nested tag claims the nearer closer, and stepping over code spans so a closer
 * written inside one stays code.
 *
 * @param subject - The leaf's text
 * @param from - Index one past the opening tag
 * @param end - Index one past the range being parsed
 * @param name - The tag name to close
 * @returns Where the closing tag begins and ends, or `null` when nothing closes it
 */
function findTagClose(
	subject: string,
	from: number,
	end: number,
	name: string,
): { start: number; end: number } | null {
	let index = from;
	let depth = 0;

	while (index < end) {
		let char = subject[index];

		if (char === "\\") {
			index += 2;
			continue;
		}

		if (char === "`") {
			index = skipCodeSpan(subject, index, end);
			continue;
		}

		if (char === "<") {
			let close = scanTagClose(subject, index);
			if (close && close.name === name && close.end <= end) {
				if (depth === 0) return { start: index, end: close.end };
				depth -= 1;
				index = close.end;
				continue;
			}

			let open = scanTagOpen(subject, index);
			if (open && open.name === name && open.end <= end && !open.selfClosing) {
				depth += 1;
				index = open.end;
				continue;
			}
		}

		index += 1;
	}

	return null;
}

/**
 * @param subject - The leaf's text
 * @param start - Index of the first backtick
 * @param end - Index one past the range being parsed
 * @returns Index one past the code span, or past the opening run when nothing closes it
 */
function skipCodeSpan(subject: string, start: number, end: number): number {
	BACKTICKS.lastIndex = start;
	let opening = BACKTICKS.exec(subject)?.[0].length ?? 1;
	let index = start + opening;

	while (index < end) {
		if (subject[index] !== "`") {
			index += 1;
			continue;
		}

		BACKTICKS.lastIndex = index;
		let run = BACKTICKS.exec(subject)?.[0].length ?? 1;
		if (run === opening) return index + run;

		index += run;
	}

	return start + opening;
}

/**
 * @param cell - A cell an email address would take characters back from
 * @returns Whether its node is the source between its own bounds, so a caller may shorten it
 */
function isVerbatimText(cell: Cell): cell is Cell & { node: Markdown.Text } {
	return cell.verbatim && cell.node.type === "text";
}

/**
 * Joins the text nodes escapes, entities, and unused delimiters left beside one
 * another, so a reader of the tree sees the words the source wrote rather than
 * the pieces the parser produced.
 *
 * @param nodes - The nodes one range produced
 * @returns The same nodes with neighbouring text merged
 */
function mergeAdjacentText(nodes: Markdown.Inline[]): Markdown.Inline[] {
	let merged: Markdown.Inline[] = [];

	for (let node of nodes) {
		let previous = merged.at(-1);

		if (previous?.type === "text" && node.type === "text") {
			previous.value += node.value;
			previous.position = { start: previous.position.start, end: node.position.end };
			continue;
		}

		merged.push(node);
	}

	return merged;
}

/**
 * One pass of the reference algorithm over a range of a leaf's text. A tag's
 * children get a pass of their own, so emphasis and brackets never reach across
 * the tag that encloses them.
 */
class InlineRun {
	#text: SourceText;
	#subject: string;
	#context: InlineContext;
	#start: number;
	#end: number;
	#pos: number;
	#cells = new Cells();
	#delimiters: Delimiter | null = null;
	#brackets: Bracket | null = null;

	/**
	 * @param text - The leaf's collected lines, carrying their source coordinates
	 * @param context - The document's reference definitions and registered tags
	 * @param start - Index into the leaf's text where this range begins
	 * @param end - Index one past the range's last character
	 */
	constructor(text: SourceText, context: InlineContext, start: number, end: number) {
		this.#text = text;
		this.#subject = text.value;
		this.#context = context;
		this.#start = start;
		this.#end = end;
		this.#pos = start;
	}

	/**
	 * @returns The range's inline nodes, or the first thing the phase could not read
	 */
	run(): Result<Markdown.Inline[], MarkdownParseError> {
		while (this.#pos < this.#end) {
			let step = this.#step();
			if (isFailure(step)) return step;
		}

		this.#processEmphasis(null);

		return success(mergeAdjacentText(this.#cells.toArray()));
	}

	/** @returns Nothing, or the error the character at the cursor produced */
	#step(): Result<undefined, MarkdownParseError> {
		let char = this.#subject[this.#pos];

		switch (char) {
			case "\n":
				this.#handleNewline();
				return OK;
			case "\\":
				this.#handleBackslash();
				return OK;
			case "`":
				this.#handleBackticks();
				return OK;
			case "*":
			case "_":
			case "~":
				this.#handleDelimiter(char);
				return OK;
			case "[":
				this.#handleOpenBracket();
				return OK;
			case "!":
				this.#handleBang();
				return OK;
			case "]":
				this.#handleCloseBracket();
				return OK;
			case "&":
				this.#handleEntity();
				return OK;
			case "{":
				this.#handleBrace();
				return OK;
			case "<":
				return this.#handleLessThan();
			default:
				if (!this.#handleLiteralAutolink()) this.#handleString();
				return OK;
		}
	}

	/**
	 * @param node - The node to add at the cursor
	 * @param start - Index in the leaf's text where its source begins
	 * @param end - Index one past its last source character
	 * @param verbatim - Whether the node's value is that source, unchanged
	 * @returns The cell holding it
	 */
	#append(node: Markdown.Inline, start: number, end: number, verbatim = false): Cell {
		return this.#cells.append(node, start, end, verbatim);
	}

	/**
	 * @param value - The text the node holds
	 * @param start - Index in the leaf's text where its source begins
	 * @param end - Index one past its last source character
	 * @param verbatim - Whether `value` is that source, unchanged
	 * @returns The cell holding it
	 */
	#appendText(value: string, start: number, end: number, verbatim = false): Cell {
		return this.#append(
			{ type: "text", value, position: this.#text.position(start, end) },
			start,
			end,
			verbatim,
		);
	}

	/** Reads the longest run of ordinary characters, which is the common case and the fast one. */
	#handleString(): void {
		let start = this.#pos;
		let index = start;

		while (index < this.#end) {
			let char = this.#subject[index] ?? "";

			if (SPECIAL.test(char)) {
				if (!this.#continuesString(char, index)) break;
			}

			index += 1;
		}

		if (index === start) index = start + 1;

		this.#appendText(this.#subject.slice(start, index), start, index, true);
		this.#pos = index;
	}

	/**
	 * Decides whether a character that ends a run really begins a node, so the
	 * letters that open a literal autolink stay part of ordinary words.
	 *
	 * @param char - The character the run reached
	 * @param index - Where it sits in the leaf's text
	 * @returns Whether the run may swallow it and carry on
	 */
	#continuesString(char: string, index: number): boolean {
		if (char === "@")
			return matchLiteralEmail(this.#subject, index, this.#start, this.#end) === null;

		if (URL_START.test(char)) {
			return matchLiteralUrl(this.#subject, index, this.#start, this.#end) === null;
		}

		return false;
	}

	/** A line ending, which is a hard break when the source left two spaces to say so. */
	#handleNewline(): void {
		let newline = this.#pos;
		let last = this.#cells.last;
		let hard = false;
		let trimmed = 0;

		if (last?.node.type === "text" && last.verbatim && last.end === newline) {
			trimmed = FINAL_SPACES.exec(last.node.value)?.[0].length ?? 0;

			if (trimmed > 0) {
				hard = trimmed >= 2;
				last.end -= trimmed;
				last.node.value = last.node.value.slice(0, last.node.value.length - trimmed);
				last.node.position = this.#text.position(last.start, last.end);
				if (last.node.value.length === 0) this.#cells.remove(last);
			}
		}

		let start = hard ? newline - trimmed : newline;
		let end = newline + 1;

		this.#append(
			hard
				? { type: "hardBreak", position: this.#text.position(start, end) }
				: { type: "softBreak", position: this.#text.position(start, end) },
			start,
			end,
		);

		this.#pos = this.#skipInitialSpaces(end);
	}

	/**
	 * @param from - Index just after a line ending
	 * @returns The first index of the next line holding something other than a space
	 */
	#skipInitialSpaces(from: number): number {
		let spaces = INITIAL_SPACES.exec(this.#subject.slice(from, this.#end))?.[0].length ?? 0;

		return from + spaces;
	}

	/** A backslash, which escapes punctuation and turns a line ending into a hard break. */
	#handleBackslash(): void {
		let start = this.#pos;
		let next = this.#subject[start + 1];

		if (next === "\n" && start + 1 < this.#end) {
			this.#append(
				{ type: "hardBreak", position: this.#text.position(start, start + 2) },
				start,
				start + 2,
			);
			this.#pos = this.#skipInitialSpaces(start + 2);
			return;
		}

		if (isEscapable(next) && start + 1 < this.#end) {
			this.#appendText(next ?? "", start, start + 2);
			this.#pos = start + 2;
			return;
		}

		this.#appendText("\\", start, start + 1, true);
		this.#pos = start + 1;
	}

	/** A backtick run, which holds code until a run of the same length closes it. */
	#handleBackticks(): void {
		let start = this.#pos;

		BACKTICKS.lastIndex = start;
		let opening = BACKTICKS.exec(this.#subject)?.[0] ?? "`";
		let contentStart = start + opening.length;
		let index = contentStart;

		while (index < this.#end) {
			if (this.#subject[index] !== "`") {
				index += 1;
				continue;
			}

			BACKTICKS.lastIndex = index;
			let run = BACKTICKS.exec(this.#subject)?.[0] ?? "`";

			if (run.length === opening.length) {
				let end = index + run.length;
				this.#append(
					{
						type: "inlineCode",
						value: stripCodeSpanPadding(this.#subject.slice(contentStart, index)),
						position: this.#text.position(start, end),
					},
					start,
					end,
				);
				this.#pos = end;
				return;
			}

			index += run.length;
		}

		this.#appendText(opening, start, contentStart, true);
		this.#pos = contentStart;
	}

	/**
	 * @param char - The delimiter character the run is made of
	 */
	#handleDelimiter(char: string): void {
		let start = this.#pos;
		let run = scanDelimiterRun(this.#subject, start, this.#end);
		let end = start + run.length;

		if (char === "~" && run.length > 2) {
			this.#appendText(this.#subject.slice(start, end), start, end, true);
			this.#pos = end;
			return;
		}

		let cell = this.#appendText(this.#subject.slice(start, end), start, end, true);

		this.#delimiters = {
			char,
			length: run.length,
			original: run.length,
			index: start,
			cell,
			canOpen: run.canOpen,
			canClose: run.canClose,
			previous: this.#delimiters,
			next: null,
		};

		if (this.#delimiters.previous) this.#delimiters.previous.next = this.#delimiters;

		this.#pos = end;
	}

	/** An opening bracket, which is a footnote reference when a caret follows it. */
	#handleOpenBracket(): void {
		let start = this.#pos;

		if (this.#subject[start + 1] === "^" && this.#handleFootnoteReference(start)) return;

		let cell = this.#appendText("[", start, start + 1, true);
		this.#addBracket(cell, start, false);
		this.#pos = start + 1;
	}

	/**
	 * @param start - Index of the `[`
	 * @returns Whether the text held a complete footnote reference
	 */
	#handleFootnoteReference(start: number): boolean {
		let length = matchLabel(this.#subject, start, this.#end);
		if (length < 4) return false;

		let identifier = normalizeIdentifier(this.#subject.slice(start + 2, start + length - 1));
		if (identifier.length === 0) return false;

		let end = start + length;

		this.#append(
			{ type: "footnoteReference", identifier, position: this.#text.position(start, end) },
			start,
			end,
		);
		this.#pos = end;

		return true;
	}

	/** An exclamation mark, which opens an image when a bracket follows it. */
	#handleBang(): void {
		let start = this.#pos;

		if (this.#subject[start + 1] !== "[") {
			this.#appendText("!", start, start + 1, true);
			this.#pos = start + 1;
			return;
		}

		let cell = this.#appendText("![", start, start + 2, true);
		this.#addBracket(cell, start + 1, true);
		this.#pos = start + 2;
	}

	/**
	 * @param cell - The text node holding the bracket as written
	 * @param index - Index of the `[`
	 * @param image - Whether an exclamation mark preceded it
	 */
	#addBracket(cell: Cell, index: number, image: boolean): void {
		let below = this.#brackets;

		if (below) below.bracketAfter = true;

		this.#brackets = {
			cell,
			index,
			image,
			active: true,
			bracketAfter: false,
			previous: below,
			previousLink: below ? (below.image ? below.previousLink : below) : null,
			previousDelimiter: this.#delimiters,
		};
	}

	/** Drops the innermost bracket, which a `]` does whether or not it found a link. */
	#removeBracket(): void {
		this.#brackets = this.#brackets?.previous ?? null;
	}

	/** A closing bracket, which claims the innermost opener when it can resolve a destination. */
	#handleCloseBracket(): void {
		let bracket = this.#pos;
		let afterBracket = bracket + 1;

		let opener = this.#brackets;

		if (!opener) {
			this.#appendText("]", bracket, afterBracket, true);
			this.#pos = afterBracket;
			return;
		}

		if (!opener.active) {
			this.#removeBracket();
			this.#appendText("]", bracket, afterBracket, true);
			this.#pos = afterBracket;
			return;
		}

		let target =
			this.#readInlineTarget(afterBracket) ?? this.#readReferenceTarget(opener, afterBracket);

		if (!target) {
			this.#removeBracket();
			this.#appendText("]", bracket, afterBracket, true);
			this.#pos = afterBracket;
			return;
		}

		this.#processEmphasis(opener.previousDelimiter);

		let start = opener.cell.start;
		let end = target.end;
		let children = mergeAdjacentText(this.#cells.extract(opener.cell.next, null));
		this.#cells.remove(opener.cell);

		let position = this.#text.position(start, end);
		let node: Markdown.Link | Markdown.Image = opener.image
			? { type: "image", src: target.href, children, position }
			: { type: "link", href: target.href, children, position };

		if (target.title !== undefined) node.title = target.title;

		this.#append(node, start, end);

		this.#removeBracket();

		if (!opener.image) {
			for (let above = opener.previousLink; above?.active; above = above.previousLink) {
				above.active = false;
			}
		}

		this.#pos = end;
	}

	/**
	 * @param from - Index just past the closing bracket
	 * @returns The destination and title written in parentheses, or `null` when none is
	 */
	#readInlineTarget(from: number): { href: string; title?: string; end: number } | null {
		if (this.#subject[from] !== "(") return null;

		let index = skipSpaceAndNewline(this.#subject, from + 1, this.#end);

		let destination = matchDestination(this.#subject, index, this.#end);
		if (!destination) return null;

		index = skipSpaceAndNewline(this.#subject, destination.end, this.#end);

		let title: string | undefined;

		if (index > destination.end) {
			let read = matchTitle(this.#subject, index, this.#end);
			if (read) {
				title = read.title;
				index = skipSpaceAndNewline(this.#subject, read.end, this.#end);
			}
		}

		if (this.#subject[index] !== ")") return null;

		return { href: destination.href, title, end: index + 1 };
	}

	/**
	 * @param opener - The bracket being closed, whose own text is the shortcut label
	 * @param from - Index just past the closing bracket
	 * @returns The definition a full, collapsed, or shortcut reference names, or `null` when none resolves
	 */
	#readReferenceTarget(
		opener: Bracket,
		from: number,
	): { href: string; title?: string; end: number } | null {
		let length = matchLabel(this.#subject, from, this.#end);
		let label: string | null = null;
		let end = from;

		if (length > 2) {
			label = this.#subject.slice(from + 1, from + length - 1);
			end = from + length;
		} else if (!opener.bracketAfter) {
			label = this.#subject.slice(opener.index + 1, from - 1);
			end = length === 2 ? from + 2 : from;
		}

		if (label === null) return null;

		let reference = this.#context.references.get(normalizeLabel(label));
		if (!reference) return null;

		return { href: reference.href, title: reference.title, end };
	}

	/** An ampersand, which is a character reference when it names one and text otherwise. */
	#handleEntity(): void {
		let start = this.#pos;
		let entity = decodeEntity(this.#subject, start);

		if (!entity || entity.end > this.#end) {
			this.#appendText("&", start, start + 1, true);
			this.#pos = start + 1;
			return;
		}

		this.#appendText(entity.value, start, entity.end);
		this.#pos = entity.end;
	}

	/** An opening brace, which holds a variable when the annotation inside it names one. */
	#handleBrace(): void {
		let start = this.#pos;
		let annotation = scanAnnotation(this.#subject, start);
		let name = annotation && annotation.end <= this.#end ? readVariableName(annotation.body) : null;

		if (!annotation || !name) {
			this.#appendText("{", start, start + 1, true);
			this.#pos = start + 1;
			return;
		}

		this.#append(
			{ type: "variable", name, position: this.#text.position(start, annotation.end) },
			start,
			annotation.end,
		);
		this.#pos = annotation.end;
	}

	/** @returns Nothing, or the error a registered tag written here produced */
	#handleLessThan(): Result<undefined, MarkdownParseError> {
		let start = this.#pos;

		let autolink = matchAutolink(this.#subject, start, this.#end);
		if (autolink) {
			this.#append(
				{
					type: "link",
					href: autolink.href,
					children: [
						{
							type: "text",
							value: autolink.label,
							position: this.#text.position(start + 1, autolink.end - 1),
						},
					],
					position: this.#text.position(start, autolink.end),
				},
				start,
				autolink.end,
			);
			this.#pos = autolink.end;
			return OK;
		}

		let definition = this.#context.options.tags.get(this.#readTagName(start));
		let open = definition ? scanTagOpen(this.#subject, start) : null;

		if (open && definition && open.end <= this.#end) return this.#handleTag(open, definition);

		let html = matchHtmlTag(this.#subject, start, this.#end);
		if (html !== -1) {
			this.#append(
				{
					type: "inlineHtml",
					value: this.#subject.slice(start, html),
					position: this.#text.position(start, html),
				},
				start,
				html,
			);
			this.#pos = html;
			return OK;
		}

		this.#appendText("<", start, start + 1, true);
		this.#pos = start + 1;

		return OK;
	}

	/**
	 * Reads the name alone, so text that opens no registered element is done with
	 * after one word rather than after a search for the `>` that closes it.
	 *
	 * @param start - Index of the `<`
	 * @returns The name written after it, or the empty string when no name is
	 */
	#readTagName(start: number): string {
		TAG_NAME.lastIndex = start + 1;

		return TAG_NAME.exec(this.#subject)?.[0] ?? "";
	}

	/**
	 * @param open - The opening tag as scanned
	 * @param definition - What the document registered under that name
	 * @returns Nothing, or the reason the tag cannot stand where it was written
	 */
	#handleTag(open: TagOpen, definition: ResolvedTag): Result<undefined, MarkdownParseError> {
		let start = this.#pos;
		let position = this.#text.position(start, open.end);

		let parsed = parseAttributeList(open.attributeText, false);
		if (isFailure(parsed)) {
			return failure(
				new MarkdownParseError(`The <${definition.name}> tag's attributes are unreadable`, {
					position,
					cause: parsed.error,
				}),
			);
		}

		let validated = this.#validateAttributes(definition, parsed.data, position);
		if (isFailure(validated)) return validated;

		if (definition.content === "none" && !open.selfClosing) {
			return failure(
				new MarkdownParseError(
					`A <${definition.name}> tag holds no children, so it is written self-closing`,
					{ position },
				),
			);
		}

		if (open.selfClosing || definition.content === "none") {
			this.#append(
				{
					type: "tag",
					name: definition.name,
					attributes: validated.data,
					children: [],
					position,
				},
				start,
				open.end,
			);
			this.#pos = open.end;
			return OK;
		}

		if (definition.content === "blocks") {
			return failure(
				new MarkdownParseError(
					`A <${definition.name}> tag whose children are blocks has nowhere to put them inside a line`,
					{ position },
				),
			);
		}

		let close = findTagClose(this.#subject, open.end, this.#end, definition.name);
		if (!close) {
			return failure(
				new MarkdownParseError(`A <${definition.name}> tag opened here is never closed`, {
					position,
				}),
			);
		}

		let children = new InlineRun(this.#text, this.#context, open.end, close.start).run();
		if (isFailure(children)) return children;

		this.#append(
			{
				type: "tag",
				name: definition.name,
				attributes: validated.data,
				children: children.data,
				position: this.#text.position(start, close.end),
			},
			start,
			close.end,
		);
		this.#pos = close.end;

		return OK;
	}

	/**
	 * Runs a tag's declared schema over the attributes the opening tag wrote, so
	 * a bad value names the opener's line rather than surfacing at render time.
	 *
	 * @param definition - What the document registered under that name
	 * @param attributes - The literals the opening tag wrote
	 * @param position - The opening tag's span, which every issue is reported at
	 * @returns The schema's output, or the issues it raised
	 */
	#validateAttributes(
		definition: ResolvedTag,
		attributes: Markdown.Attributes,
		position: Markdown.Position,
	): Result<Markdown.Attributes, MarkdownParseError> {
		let schema = definition.attributes;
		if (!schema) return success(attributes);

		let result = schema["~standard"].validate(attributes);

		if (result instanceof Promise) {
			return failure(
				new MarkdownParseError(
					`The <${definition.name}> tag's attribute schema is asynchronous, and attributes are validated while the document is read`,
					{ position },
				),
			);
		}

		if (result.issues) {
			return failure(
				new MarkdownParseError(`The <${definition.name}> tag's attributes are invalid`, {
					position,
					issues: result.issues,
				}),
			);
		}

		return success(result.value as Markdown.Attributes);
	}

	/** @returns Whether the cursor sat on a bare URL or email address GFM turns into a link */
	#handleLiteralAutolink(): boolean {
		let start = this.#pos;
		let char = this.#subject[start];

		if (char !== undefined && URL_START.test(char)) {
			let url = matchLiteralUrl(this.#subject, start, this.#start, this.#end);
			if (!url) return false;

			this.#appendAutolink(url.href, url.label, start, url.end);
			return true;
		}

		if (char !== "@") return false;

		let email = matchLiteralEmail(this.#subject, start, this.#start, this.#end);
		if (!email || !this.#retractTo(email.start)) return false;

		this.#appendAutolink(email.href, email.label, email.start, email.end);

		return true;
	}

	/**
	 * @param href - Where the link points
	 * @param label - The text the source wrote, which a renderer shows as typed
	 * @param start - Index the link begins at
	 * @param end - Index one past its last character
	 */
	#appendAutolink(href: string, label: string, start: number, end: number): void {
		this.#append(
			{
				type: "link",
				href,
				children: [{ type: "text", value: label, position: this.#text.position(start, end) }],
				position: this.#text.position(start, end),
			},
			start,
			end,
		);
		this.#pos = end;
	}

	/**
	 * Gives back the characters an email address claims from the text already
	 * written, which is what lets the local part be read after the at sign. An
	 * underscore in it sits in a cell of its own, so the walk spans several.
	 *
	 * @param to - Index the text should end at
	 * @returns Whether the nodes reaching back that far are all verbatim text
	 */
	#retractTo(to: number): boolean {
		let anchor = this.#cells.last;
		let boundary = this.#pos;

		while (anchor && anchor.start > to) {
			if (!isVerbatimText(anchor) || anchor.end !== boundary) return false;
			boundary = anchor.start;
			anchor = anchor.previous;
		}

		if (!anchor || !isVerbatimText(anchor) || anchor.end !== boundary) return false;

		for (let cell = this.#cells.last; cell && cell !== anchor; cell = this.#cells.last) {
			this.#cells.remove(cell);
		}

		while (this.#delimiters && this.#delimiters.index >= to) {
			this.#removeDelimiter(this.#delimiters);
		}

		if (anchor.start === to) {
			this.#cells.remove(anchor);
			return true;
		}

		anchor.end = to;
		anchor.node.value = this.#subject.slice(anchor.start, to);
		anchor.node.position = this.#text.position(anchor.start, to);

		return true;
	}

	/**
	 * @param delimiter - The run to drop from the stack, whose text node stays where it is
	 */
	#removeDelimiter(delimiter: Delimiter): void {
		if (delimiter.previous) delimiter.previous.next = delimiter.next;
		if (delimiter.next) delimiter.next.previous = delimiter.previous;
		else this.#delimiters = delimiter.previous;
	}

	/**
	 * Resolves every emphasis span above `bottom`, which is the algorithm
	 * CommonMark's appendix spells out, tildes included. A closer that finds no
	 * opener raises a floor for its kind, so the next one stops where it gave up.
	 *
	 * @param bottom - The delimiter the search stops at, or `null` for the whole stack
	 */
	#processEmphasis(bottom: Delimiter | null): void {
		let floor = bottom ? bottom.index : -1;
		let openersBottom = new Map<string, number>();

		let closer = this.#delimiters;
		while (closer && closer.previous !== bottom) closer = closer.previous;

		while (closer) {
			if (!closer.canClose) {
				closer = closer.next;
				continue;
			}

			let key = `${closer.char}${closer.canOpen ? "o" : "c"}${closer.original % 3}`;
			let limit = openersBottom.get(key) ?? floor;

			let opener = closer.previous;
			let found: Delimiter | null = null;

			while (opener && opener.index > limit) {
				if (opener.char === closer.char && opener.canOpen && pairs(opener, closer)) {
					found = opener;
					break;
				}
				opener = opener.previous;
			}

			let candidate = closer;

			if (found) {
				closer = this.#wrap(found, closer);
				continue;
			}

			closer = closer.next;
			openersBottom.set(key, candidate.previous ? candidate.previous.index : floor);
			if (!candidate.canOpen) this.#removeDelimiter(candidate);
		}

		while (this.#delimiters && this.#delimiters !== bottom) this.#removeDelimiter(this.#delimiters);
	}

	/**
	 * Spends delimiters from both runs, wraps everything between them, and drops
	 * whichever run the span used up.
	 *
	 * @param opener - The run the span opens with
	 * @param closer - The run the span closes with
	 * @returns The next closer to consider
	 */
	#wrap(opener: Delimiter, closer: Delimiter): Delimiter | null {
		let used =
			opener.char === "~" ? closer.length : closer.length >= 2 && opener.length >= 2 ? 2 : 1;

		opener.length -= used;
		closer.length -= used;

		let openerCell = opener.cell;
		let closerCell = closer.cell;

		openerCell.end -= used;
		closerCell.start += used;

		let children = mergeAdjacentText(this.#cells.extract(openerCell.next, closerCell));
		let position = this.#text.position(openerCell.end, closerCell.start);

		this.#cells.insertAfter(
			openerCell,
			opener.char === "~"
				? { type: "strikethrough", children, position }
				: used === 1
					? { type: "emphasis", children, position }
					: { type: "strong", children, position },
			openerCell.end,
			closerCell.start,
		);

		this.#trim(openerCell, opener);
		this.#trim(closerCell, closer);

		if (opener.next !== closer) {
			opener.next = closer;
			closer.previous = opener;
		}

		if (opener.length === 0) {
			this.#cells.remove(openerCell);
			this.#removeDelimiter(opener);
		}

		if (closer.length > 0) return closer;

		let next = closer.next;
		this.#cells.remove(closerCell);
		this.#removeDelimiter(closer);

		return next;
	}

	/**
	 * @param cell - The text node holding a delimiter run
	 * @param delimiter - The run, whose remaining length is what the node keeps
	 */
	#trim(cell: Cell, delimiter: Delimiter): void {
		if (cell.node.type !== "text") return;

		cell.node.value = delimiter.char.repeat(delimiter.length);
		cell.node.position = this.#text.position(cell.start, cell.end);
	}
}

/**
 * Applies CommonMark's code span rules: every line ending becomes a space, and
 * one space is stripped from each end when both are there and something else is.
 *
 * @param content - The text between the backtick runs
 * @returns The code the span holds
 */
function stripCodeSpanPadding(content: string): string {
	let code = content.replace(/\n/g, " ");

	if (code.length > 2 && code.startsWith(" ") && code.endsWith(" ") && /[^ ]/.test(code)) {
		return code.slice(1, -1);
	}

	return code;
}

/**
 * Applies the rule of three, which keeps `*foo**bar*` from pairing across its
 * middle run, and the equal-length rule GFM gives tildes.
 *
 * @param opener - The candidate opening run
 * @param closer - The run looking for an opener
 * @returns Whether the two may form a span
 */
function pairs(opener: Delimiter, closer: Delimiter): boolean {
	if (opener.char === "~") return opener.length === closer.length;

	let odd =
		(closer.canOpen || opener.canClose) &&
		closer.original % 3 !== 0 &&
		(opener.original + closer.original) % 3 === 0;

	return !odd;
}
