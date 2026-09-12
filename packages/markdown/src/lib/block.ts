/**
 * The first phase of the reference strategy: containers opened and closed line by
 * line, leaves collecting their text, and this dialect's block tags taking part as
 * containers of their own. Inline parsing runs over the finished tree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Markdown } from "../index.js";

import type { Line } from "./block/lines.js";
import type { Alignment } from "./block/table.js";
import type { Reference } from "./inline.js";
import type { ResolvedOptions, ResolvedTag } from "./options.js";
import type { Chunk } from "./source.js";

import {
	parseAttributeList,
	readVariableName,
	scanAnnotation,
	scanTagClose,
	scanTagOpen,
} from "./attributes.js";
import { closesHtmlBlock, readHtmlBlockKind } from "./block/html.js";
import { splitLines } from "./block/lines.js";
import { normalizeIdentifier, readDefinition } from "./block/reference.js";
import { readDelimiterRow, splitCells } from "./block/table.js";
import { MarkdownParseError } from "./errors.js";
import { normalizeLabel, parseInlines } from "./inline.js";
import { unescapeString } from "./inline/scan.js";
import { SourceText } from "./source.js";

/** The indentation that opens a code block, and the width a tab stop advances to. */
const CODE_INDENT = 4;

const ATX_HEADING = /^#{1,6}(?:[ \t]+|$)/;
const ATX_EMPTY_CLOSING = /^[ \t]*#+[ \t]*$/;
const ATX_CLOSING = /[ \t]+#+[ \t]*$/;
const CODE_FENCE = /^`{3,}(?!.*`)|^~{3,}/;
const CLOSING_CODE_FENCE = /^(?:`{3,}|~{3,})(?=[ \t]*$)/;
const SETEXT_UNDERLINE = /^(?:=+|-+)[ \t]*$/;
const THEMATIC_BREAK = /^(?:\*[ \t]*){3,}$|^(?:_[ \t]*){3,}$|^(?:-[ \t]*){3,}$/;
const BULLET_MARKER = /^[*+-]/;
const ORDERED_MARKER = /^(\d{1,9})([.)])/;
const FOOTNOTE_MARKER = /^\[\^([^\]\s]+)\]:[ \t]*/;
const ALERT_MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*$/i;
const TASK_MARKER = /^\[([ xX])\]\s/;
const TRAILING_SPACE = /[ \t]+$/;

/** The open blocks the first phase builds, before any of them becomes an AST node. */
type OpenType =
	| "document"
	| "blockquote"
	| "list"
	| "listItem"
	| "footnoteDefinition"
	| "tag"
	| "paragraph"
	| "heading"
	| "code"
	| "html"
	| "table"
	| "thematicBreak";

/** What a start condition did with the line, which decides whether the walk continues. */
type StartOutcome = "none" | "container" | "leaf" | "consumed";

/** How a container answered for the current line. */
type ContinueOutcome = "matched" | "closed" | "consumed";

/** What the source wrote about a list, carried by the list and each of its items. */
interface ListData {
	ordered: boolean;
	bulletChar: string;
	delimiter: string;
	start: number;
	/** Columns from the marker's first character to the item's content. */
	padding: number;
	/** Columns of indentation before the marker. */
	markerOffset: number;
	tight: boolean;
}

/** An annotation waiting for the block it decorates, and where it was written. */
interface Pending {
	attributes: Markdown.Attributes;
	position: Markdown.Position;
}

/** One block while it is still open, holding everything the second pass reads back. */
interface OpenNode {
	type: OpenType;
	parent: OpenNode | null;
	children: OpenNode[];
	open: boolean;
	/** The lines a leaf collected, each located in the source. */
	chunks: Chunk[];
	/** The literal text of a code or HTML block, built when the block closes. */
	content: string;
	attributes: Markdown.Attributes;
	pending: Pending | null;
	start: Markdown.Point;
	end: Markdown.Point;
	lastLineBlank: boolean;
	lastLineChecked: boolean;
	level: 1 | 2 | 3 | 4 | 5 | 6;
	language?: string;
	fenced: boolean;
	fenceChar: string;
	fenceLength: number;
	fenceIndent: number;
	htmlKind: number;
	list?: ListData;
	checked?: boolean;
	alertKind?: Markdown.Alert["kind"];
	identifier?: string;
	tagName?: string;
	tagContent?: ResolvedTag["content"];
	tagClosed: boolean;
	/** The opening tag's own span, which is where a tag failure is reported. */
	openPosition?: Markdown.Position;
	align?: Alignment[];
}

/**
 * Reads a document body into blocks.
 *
 * @param source - The whole file, so positions index it as written
 * @param start - Where the body begins, which is past any frontmatter block
 * @param options - The tags this document may use
 * @returns The parsed document, or the first thing the phase could not read
 */
export function parseBlocks(
	source: string,
	start: Markdown.Point,
	options: ResolvedOptions,
): Result<Markdown.Document, Markdown.ParseError> {
	return new BlockParser(splitLines(source, start), start, options).run();
}

/**
 * Walks the source once to build the block tree, then walks the finished tree to
 * read every inline-bearing leaf. Splitting the two is what lets a reference
 * defined on the last line resolve for a link written on the first.
 */
class BlockParser {
	#lines: Line[];
	#options: ResolvedOptions;
	#references = new Map<string, Reference>();
	#document: OpenNode;
	#tip: OpenNode;
	#oldTip: OpenNode;
	#lastMatched: OpenNode;
	#allClosed = true;
	#line: Line;
	#offset = 0;
	#column = 0;
	#nextNonspace = 0;
	#nextNonspaceColumn = 0;
	#indent = 0;
	#indented = false;
	#blank = false;
	#partialTab = false;
	#error: MarkdownParseError | null = null;
	/** Openers of `content: "none"` tags, so a closer for one names the line it opened on. */
	#voidOpeners = new Map<string, Markdown.Position>();

	/**
	 * @param lines - The body's lines, in source order
	 * @param start - Where the body begins in the file
	 * @param options - The tags this document may use
	 */
	constructor(lines: Line[], start: Markdown.Point, options: ResolvedOptions) {
		this.#lines = lines;
		this.#options = options;
		this.#document = createNode("document", start);
		this.#tip = this.#document;
		this.#oldTip = this.#document;
		this.#lastMatched = this.#document;
		this.#line = { text: "", line: start.line, columnBase: start.column, offset: start.offset };
	}

	/**
	 * @returns The document, or the first thing either phase could not read
	 */
	run(): Result<Markdown.Document, Markdown.ParseError> {
		for (let line of this.#lines) {
			this.#incorporate(line);
			if (this.#error) return failure(this.#error);
		}

		while (this.#tip.parent) this.#finalize(this.#tip);
		this.#finalize(this.#document);

		if (this.#error) return failure(this.#error);

		let children = this.#buildBlocks(this.#document);
		if (isFailure(children)) return children;

		return success({
			type: "document",
			children: children.data,
			position: { start: this.#document.start, end: this.#document.end },
		});
	}

	/**
	 * One line against the open container stack: match what continues, open what
	 * starts, and hand what remains to the leaf that accepts lines.
	 *
	 * @param line - The line to read
	 */
	#incorporate(line: Line): void {
		let container = this.#document;

		this.#oldTip = this.#tip;
		this.#offset = 0;
		this.#column = 0;
		this.#blank = false;
		this.#partialTab = false;
		this.#line = line;

		let lastChild = lastOf(container.children);

		while (lastChild?.open) {
			container = lastChild;
			this.#findNextNonspace();

			let outcome = this.#continueBlock(container);
			if (outcome === "consumed") return this.#extend();

			if (outcome === "closed") {
				container = container.parent ?? this.#document;
				break;
			}

			lastChild = lastOf(container.children);
		}

		this.#allClosed = container === this.#oldTip;
		this.#lastMatched = container;

		let matchedLeaf = !opensInsideLeaf(container) && acceptsLines(container);

		while (!matchedLeaf) {
			this.#findNextNonspace();

			let started = this.#tryStarts(container);
			if (this.#error) return;

			if (started === "none") {
				this.#advanceNextNonspace();
				break;
			}

			container = this.#tip;

			if (started === "consumed") {
				this.#markBlank(container);
				return this.#extend();
			}

			if (started === "leaf") matchedLeaf = true;
		}

		this.#addRemainder(container);
		this.#extend();
	}

	/**
	 * Whatever is left of the line after the container prefixes and any new starts.
	 * A paragraph whose container did not match still takes the line, which is
	 * CommonMark's lazy continuation.
	 *
	 * @param container - The block the line ended up inside
	 */
	#addRemainder(container: OpenNode): void {
		if (!this.#allClosed && !this.#blank && this.#tip.type === "paragraph") {
			this.#addLine();
			return;
		}

		this.#closeUnmatched();
		this.#markBlank(container);

		if (acceptsLines(container)) {
			this.#addLine();

			if (
				container.type === "html" &&
				container.htmlKind <= 5 &&
				closesHtmlBlock(container.htmlKind, this.#line.text.slice(this.#offset))
			) {
				container.end = this.#lineEnd();
				this.#finalize(container);
			}

			return;
		}

		if (this.#offset < this.#line.text.length && !this.#blank) {
			this.#addChild("paragraph", this.#offset);
			this.#advanceNextNonspace();
			this.#addLine();
		}
	}

	/**
	 * Whether an open block takes this line. A container that matches consumes its
	 * own prefix as it answers, so the offset is left where its content begins.
	 *
	 * @param node - The open block to ask
	 * @returns Whether the block continues, ends, or has taken the whole line
	 */
	#continueBlock(node: OpenNode): ContinueOutcome {
		if (node.type === "document" || node.type === "list") return "matched";
		if (node.type === "blockquote") return this.#continueBlockquote();
		if (node.type === "listItem") return this.#continueItem(node);
		if (node.type === "footnoteDefinition") return this.#continueFootnote();
		if (node.type === "tag") return this.#continueTag(node);
		if (node.type === "code") return this.#continueCode(node);
		if (node.type === "html") return this.#blank && node.htmlKind >= 6 ? "closed" : "matched";
		if (node.type === "paragraph" || node.type === "table") {
			return this.#blank ? "closed" : "matched";
		}

		return "closed";
	}

	/** A quote continues on its marker, which may take one space of padding with it. */
	#continueBlockquote(): ContinueOutcome {
		if (this.#indented || this.#line.text.charAt(this.#nextNonspace) !== ">") return "closed";

		this.#advanceNextNonspace();
		this.#advanceOffset(1, false);
		if (isSpaceOrTab(this.#line.text.charAt(this.#offset))) this.#advanceOffset(1, true);

		return "matched";
	}

	/** An item continues on indentation past its marker; a blank line only opens content. */
	#continueItem(node: OpenNode): ContinueOutcome {
		let data = node.list;
		if (!data) return "closed";

		if (this.#blank) {
			if (node.children.length === 0) return "closed";
			this.#advanceNextNonspace();
			return "matched";
		}

		if (this.#indent >= data.markerOffset + data.padding) {
			this.#advanceOffset(data.markerOffset + data.padding, true);
			return "matched";
		}

		return "closed";
	}

	/** A footnote's body continues on four columns of indentation, as GitHub reads it. */
	#continueFootnote(): ContinueOutcome {
		if (this.#blank) {
			this.#advanceNextNonspace();
			return "matched";
		}

		if (this.#indent >= CODE_INDENT) {
			this.#advanceOffset(CODE_INDENT, true);
			return "matched";
		}

		return "closed";
	}

	/** A block tag runs to its closer; an inline-content tag watches for it itself. */
	#continueTag(node: OpenNode): ContinueOutcome {
		if (node.tagContent !== "inline") return "matched";

		if (!this.#indented) {
			let close = scanTagClose(this.#line.text, this.#nextNonspace);
			if (close && close.name === node.tagName && this.#restIsBlank(close.end)) {
				node.tagClosed = true;
				node.end = this.#lineEnd();
				this.#finalize(node);
				return "consumed";
			}
		}

		return "matched";
	}

	/** A fence ends on a longer run of its own character; indented code ends on content. */
	#continueCode(node: OpenNode): ContinueOutcome {
		if (node.fenced) {
			let rest = this.#line.text.slice(this.#nextNonspace);
			let match =
				this.#indent <= 3 && rest.charAt(0) === node.fenceChar
					? CLOSING_CODE_FENCE.exec(rest)
					: null;

			if (match && match[0].length >= node.fenceLength) {
				node.end = this.#lineEnd();
				this.#finalize(node);
				return "consumed";
			}

			let remaining = node.fenceIndent;
			while (remaining > 0 && isSpaceOrTab(this.#line.text.charAt(this.#offset))) {
				this.#advanceOffset(1, true);
				remaining -= 1;
			}

			return "matched";
		}

		if (this.#indent >= CODE_INDENT) {
			this.#advanceOffset(CODE_INDENT, true);
			return "matched";
		}

		if (this.#blank) {
			this.#advanceNextNonspace();
			return "matched";
		}

		return "closed";
	}

	/**
	 * The start conditions, in the order CommonMark checks them, with this
	 * dialect's annotation and tag conditions ahead of the HTML block they would
	 * otherwise be read as.
	 *
	 * @param container - The deepest block the line matched into
	 * @returns What the line opened, if anything
	 */
	#tryStarts(container: OpenNode): StartOutcome {
		let outcome = this.#tryBlockquote();
		if (outcome !== "none") return outcome;

		outcome = this.#tryAnnotation(container);
		if (outcome !== "none") return outcome;

		outcome = this.#tryAtxHeading();
		if (outcome !== "none") return outcome;

		outcome = this.#tryCodeFence();
		if (outcome !== "none") return outcome;

		outcome = this.#tryTagClose();
		if (outcome !== "none") return outcome;

		outcome = this.#tryTagOpen();
		if (outcome !== "none") return outcome;

		outcome = this.#tryHtmlBlock(container);
		if (outcome !== "none") return outcome;

		outcome = this.#trySetextHeading(container);
		if (outcome !== "none") return outcome;

		outcome = this.#tryTable(container);
		if (outcome !== "none") return outcome;

		outcome = this.#tryThematicBreak();
		if (outcome !== "none") return outcome;

		outcome = this.#tryFootnote();
		if (outcome !== "none") return outcome;

		outcome = this.#tryListItem(container);
		if (outcome !== "none") return outcome;

		return this.#tryIndentedCode();
	}

	/** `>` opens a quote, which is a container so the rest of the line keeps starting blocks. */
	#tryBlockquote(): StartOutcome {
		if (this.#indented || this.#line.text.charAt(this.#nextNonspace) !== ">") return "none";

		this.#advanceNextNonspace();
		this.#advanceOffset(1, false);
		if (isSpaceOrTab(this.#line.text.charAt(this.#offset))) this.#advanceOffset(1, true);

		this.#closeUnmatched();
		this.#addChild("blockquote", this.#nextNonspace);

		return "container";
	}

	/**
	 * An annotation on its own line decorates the next block in the same container,
	 * across an intervening blank line. It waits rather than opening anything, so
	 * a second annotation above the same block merges into the first.
	 *
	 * @param container - The deepest block the line matched into
	 * @returns Whether the line was an annotation
	 */
	#tryAnnotation(container: OpenNode): StartOutcome {
		if (this.#indented || container.type === "paragraph") return "none";

		let text = this.#line.text.slice(this.#nextNonspace).replace(TRAILING_SPACE, "");
		if (!text.startsWith("{%")) return "none";

		let found = scanAnnotation(text, 0);
		if (!found || found.end !== text.length) return "none";
		if (readVariableName(found.body) !== null) return "none";

		let parsed = parseAttributeList(found.body, true);
		if (isFailure(parsed)) {
			this.#fail(parsed.error.message, this.#lineSpan());
			return "consumed";
		}

		this.#closeUnmatched();
		while (this.#tip.parent && !isContainer(this.#tip)) this.#finalize(this.#tip);

		let pending = this.#tip.pending;
		this.#tip.pending = {
			attributes: { ...pending?.attributes, ...parsed.data },
			position: pending?.position ?? this.#lineSpan(),
		};

		this.#advanceOffset(this.#line.text.length - this.#offset, false);

		return "consumed";
	}

	/** `#` opens a heading whose whole text, and any trailing annotation, sit on this line. */
	#tryAtxHeading(): StartOutcome {
		if (this.#indented) return "none";

		let match = ATX_HEADING.exec(this.#line.text.slice(this.#nextNonspace));
		if (!match) return "none";

		this.#advanceNextNonspace();
		this.#advanceOffset(match[0].length, false);
		this.#closeUnmatched();

		let node = this.#addChild("heading", this.#nextNonspace);
		node.level = match[0].trim().length as OpenNode["level"];

		this.#readHeadingText(node);
		this.#advanceOffset(this.#line.text.length - this.#offset, false);

		return "leaf";
	}

	/**
	 * The heading's text, with its optional closing sequence and its optional
	 * trailing annotation taken off.
	 *
	 * @param node - The heading being opened
	 */
	#readHeadingText(node: OpenNode): void {
		let base = this.#offset;
		let body = this.#line.text.slice(base).replace(ATX_EMPTY_CLOSING, "").replace(ATX_CLOSING, "");

		let lead = 0;
		while (lead < body.length && isSpaceOrTab(body.charAt(lead))) lead += 1;

		let text = body.slice(lead).replace(TRAILING_SPACE, "");
		let annotated = this.#takeTrailingAnnotation(text);
		if (!annotated) return;

		node.attributes = { ...node.attributes, ...annotated.attributes };
		node.chunks.push(this.#chunkAt(base + lead, annotated.text));
	}

	/** Three or more backticks or tildes open a fence whose first line is its info string. */
	#tryCodeFence(): StartOutcome {
		if (this.#indented) return "none";

		let match = CODE_FENCE.exec(this.#line.text.slice(this.#nextNonspace));
		if (!match) return "none";

		this.#closeUnmatched();

		let node = this.#addChild("code", this.#nextNonspace);
		node.fenced = true;
		node.fenceChar = match[0].charAt(0);
		node.fenceLength = match[0].length;
		node.fenceIndent = this.#indent;

		this.#advanceNextNonspace();
		this.#advanceOffset(match[0].length, false);

		return "leaf";
	}

	/**
	 * A closing tag alone on its line ends the innermost block tag of that name.
	 * Reaching one while a differently named tag is still open reports that tag,
	 * because it is the one the document never closed.
	 *
	 * @returns Whether the line closed a tag
	 */
	#tryTagClose(): StartOutcome {
		if (this.#indented) return "none";

		let close = scanTagClose(this.#line.text, this.#nextNonspace);
		if (!close || !this.#restIsBlank(close.end)) return "none";

		let definition = this.#options.tags.get(close.name);
		if (!definition) return "none";

		if (definition.content === "none") {
			this.#fail(
				`<${close.name}> is written self-closing, so it takes no closing tag`,
				this.#voidOpeners.get(close.name) ?? this.#lineSpan(),
			);
			return "consumed";
		}

		let innermost = this.#innermostTag();
		if (!innermost) return "none";

		if (innermost.tagName !== close.name) {
			if (!this.#hasOpenTag(close.name)) return "none";
			this.#fail(`Unclosed tag <${innermost.tagName}>`, this.#tagSpan(innermost));
			return "consumed";
		}

		this.#closeUnmatched();
		while (this.#tip !== innermost && this.#tip.parent) this.#finalize(this.#tip);

		innermost.tagClosed = true;
		innermost.end = this.#lineEnd();
		this.#finalize(innermost);

		this.#advanceOffset(this.#line.text.length - this.#offset, false);

		return "consumed";
	}

	/**
	 * A registered opening tag alone on its line opens a block tag. Its attributes
	 * are read and validated here, ahead of its children, so a bad attribute names
	 * the opener even when the body runs long.
	 *
	 * @returns Whether the line opened a tag
	 */
	#tryTagOpen(): StartOutcome {
		if (this.#indented) return "none";

		let open = scanTagOpen(this.#line.text, this.#nextNonspace);
		if (!open) return "none";

		let definition = this.#options.tags.get(open.name);
		if (!definition) return "none";

		let inner = this.#restIsBlank(open.end) ? null : this.#readOneLineTag(open.name, open.end);
		if (inner === null && !this.#restIsBlank(open.end)) return "none";
		if (inner !== null && definition.content !== "inline") return "none";

		let span = { start: this.#pointAt(this.#nextNonspace), end: this.#pointAt(open.end) };
		let attributes = this.#readTagAttributes(definition, open.attributeText, span);
		if (!attributes) return "consumed";

		this.#closeUnmatched();

		let node = this.#addChild("tag", this.#nextNonspace);
		node.tagName = open.name;
		node.tagContent = definition.content;
		node.openPosition = span;
		node.attributes = { ...node.attributes, ...attributes };

		if (inner !== null) node.chunks.push(this.#chunkAt(open.end, inner));

		this.#advanceOffset(this.#line.text.length - this.#offset, false);

		if (definition.content === "none") this.#voidOpeners.set(open.name, span);

		if (definition.content === "none" || open.selfClosing || inner !== null) {
			node.tagClosed = true;
			node.end = this.#lineEnd();
			this.#finalize(node);
		}

		return "consumed";
	}

	/**
	 * The text between an opening tag and a closing tag that ends the same line.
	 * A tag written whole on one line is still block-level, so its content never
	 * drags the line into a paragraph around it.
	 *
	 * @param name - The tag's name
	 * @param start - Index just past the opening tag
	 * @returns The text between the tags, or `null` when the line holds anything else
	 */
	#readOneLineTag(name: string, start: number): string | null {
		let text = this.#line.text;

		for (let index = text.length - 1; index >= start; index--) {
			if (text.charAt(index) !== "<") continue;

			let close = scanTagClose(text, index);
			if (close?.name === name && this.#restIsBlank(close.end)) return text.slice(start, index);
		}

		return null;
	}

	/**
	 * Reads the opening tag's attributes and runs the declared schema over them.
	 *
	 * @param definition - The registered tag
	 * @param text - The attribute list, without its delimiters
	 * @param position - The opening tag's span, which a failure is reported at
	 * @returns The validated attributes, or `null` when the failure is already recorded
	 */
	#readTagAttributes(
		definition: ResolvedTag,
		text: string,
		position: Markdown.Position,
	): Markdown.Attributes | null {
		let parsed = parseAttributeList(text, false);
		if (isFailure(parsed)) {
			this.#fail(parsed.error.message, position);
			return null;
		}

		let schema = definition.attributes;
		if (!schema) return parsed.data;

		let validated = schema["~standard"].validate(parsed.data);
		if (validated instanceof Promise) {
			this.#fail("Asynchronous attribute schemas are not supported", position);
			return null;
		}

		if (validated.issues) {
			this.#fail(`Invalid attributes for <${definition.name}>`, position, validated.issues);
			return null;
		}

		return validated.value as Markdown.Attributes;
	}

	/** An unregistered element falls back to CommonMark's own seven HTML block conditions. */
	#tryHtmlBlock(container: OpenNode): StartOutcome {
		if (this.#indented || this.#line.text.charAt(this.#nextNonspace) !== "<") return "none";

		let kind = readHtmlBlockKind(
			this.#line.text.slice(this.#nextNonspace),
			container.type === "paragraph",
		);
		if (kind === null) return "none";

		this.#closeUnmatched();

		let node = this.#addChild("html", this.#offset);
		node.htmlKind = kind;

		return "leaf";
	}

	/** An underline turns the paragraph above it into a heading, definitions taken out first. */
	#trySetextHeading(container: OpenNode): StartOutcome {
		if (this.#indented || container.type !== "paragraph") return "none";
		if (!SETEXT_UNDERLINE.test(this.#line.text.slice(this.#nextNonspace))) return "none";

		this.#closeUnmatched();
		this.#stripDefinitions(container);
		if (container.chunks.length === 0) return "none";

		container.start = pointOf(container.chunks[0]);
		container.type = "heading";
		container.level = this.#line.text.charAt(this.#nextNonspace) === "=" ? 1 : 2;
		container.end = this.#lineEnd();

		this.#advanceOffset(this.#line.text.length - this.#offset, false);
		this.#finalize(container);

		return "consumed";
	}

	/** A delimiter row under a single line of prose turns that line into a table header. */
	#tryTable(container: OpenNode): StartOutcome {
		if (this.#indented || container.type !== "paragraph") return "none";
		if (container.chunks.length !== 1) return "none";

		let align = readDelimiterRow(this.#line.text.slice(this.#nextNonspace));
		if (!align) return "none";

		let header = splitCells(lastOf(container.chunks)?.text ?? "");
		if (header.length !== align.length) return "none";

		this.#closeUnmatched();

		container.type = "table";
		container.align = align;

		this.#advanceOffset(this.#line.text.length - this.#offset, false);

		return "consumed";
	}

	/** Three or more of one marker with nothing else on the line. */
	#tryThematicBreak(): StartOutcome {
		if (this.#indented) return "none";
		if (!THEMATIC_BREAK.test(this.#line.text.slice(this.#nextNonspace))) return "none";

		this.#closeUnmatched();
		this.#addChild("thematicBreak", this.#nextNonspace);
		this.#advanceOffset(this.#line.text.length - this.#offset, false);

		return "leaf";
	}

	/** `[^label]:` opens a container whose body is indented under it. */
	#tryFootnote(): StartOutcome {
		if (this.#indented) return "none";

		let match = FOOTNOTE_MARKER.exec(this.#line.text.slice(this.#nextNonspace));
		if (!match) return "none";

		this.#closeUnmatched();

		let node = this.#addChild("footnoteDefinition", this.#nextNonspace);
		node.identifier = normalizeIdentifier(match[1] ?? "");

		this.#advanceNextNonspace();
		this.#advanceOffset(match[0].length, true);

		return "container";
	}

	/** A marker opens an item, and a list around it when the marker changed or none was open. */
	#tryListItem(container: OpenNode): StartOutcome {
		if (this.#indented && container.type !== "list") return "none";

		let data = this.#parseListMarker(container);
		if (!data) return "none";

		let markerAt = this.#nextNonspace;
		this.#closeUnmatched();

		if (this.#tip.type !== "list" || !listsMatch(this.#tip.list, data)) {
			let list = this.#addChild("list", markerAt);
			list.list = { ...data };
		}

		let item = this.#addChild("listItem", markerAt);
		item.list = data;

		return "container";
	}

	/**
	 * Reads a bullet or ordered marker and the padding that follows it, which is
	 * what every later line of the item has to clear to stay inside it.
	 *
	 * @param container - The deepest block the line matched into
	 * @returns The item's list data, or `null` when the line opens no item
	 */
	#parseListMarker(container: OpenNode): ListData | null {
		if (this.#indent >= CODE_INDENT) return null;

		let rest = this.#line.text.slice(this.#nextNonspace);
		let bullet = BULLET_MARKER.exec(rest);
		let ordered = bullet ? null : ORDERED_MARKER.exec(rest);
		let data: ListData;
		let markerLength: number;

		if (bullet) {
			data = blankListData(false);
			data.bulletChar = bullet[0];
			markerLength = bullet[0].length;
		} else if (ordered && (container.type !== "paragraph" || ordered[1] === "1")) {
			data = blankListData(true);
			data.delimiter = ordered[2] ?? ".";
			data.start = Number(ordered[1] ?? "1");
			markerLength = ordered[0].length;
		} else {
			return null;
		}

		data.markerOffset = this.#indent;

		let after = this.#line.text.charAt(this.#nextNonspace + markerLength);
		if (after !== "" && !isSpaceOrTab(after)) return null;

		let content = this.#line.text.slice(this.#nextNonspace + markerLength);
		if (container.type === "paragraph" && !/[^ \t]/.test(content)) return null;

		this.#advanceNextNonspace();
		this.#advanceOffset(markerLength, true);

		let spacesColumn = this.#column;
		let spacesOffset = this.#offset;

		do {
			this.#advanceOffset(1, true);
		} while (this.#column - spacesColumn < 5 && isSpaceOrTab(this.#line.text.charAt(this.#offset)));

		let empty = this.#line.text.charAt(this.#offset) === "";
		let spaces = this.#column - spacesColumn;

		if (spaces >= 5 || spaces < 1 || empty) {
			data.padding = markerLength + 1;
			this.#column = spacesColumn;
			this.#offset = spacesOffset;
			this.#partialTab = false;
			if (isSpaceOrTab(this.#line.text.charAt(this.#offset))) this.#advanceOffset(1, true);
		} else {
			data.padding = markerLength + spaces;
		}

		return data;
	}

	/** Four columns of indentation with no paragraph to continue opens literal code. */
	#tryIndentedCode(): StartOutcome {
		if (!this.#indented || this.#tip.type === "paragraph" || this.#blank) return "none";

		this.#advanceOffset(CODE_INDENT, true);
		this.#closeUnmatched();
		this.#addChild("code", this.#offset);

		return "leaf";
	}

	/**
	 * Attaches a new block under the deepest block that can hold it, closing any
	 * leaf in the way and handing it whatever annotation was waiting there.
	 *
	 * @param type - The kind of block to open
	 * @param index - Where in the line the block begins
	 * @returns The opened block, which becomes the tip
	 */
	#addChild(type: OpenType, index: number): OpenNode {
		while (this.#tip.parent && !canContain(this.#tip, type)) this.#finalize(this.#tip);

		let node = createNode(type, this.#pointAt(index));
		node.parent = this.#tip;
		this.#tip.children.push(node);

		let pending = this.#tip.pending;
		if (pending) {
			node.attributes = { ...pending.attributes };
			this.#tip.pending = null;
		}

		this.#tip = node;

		return node;
	}

	/** Closes every block the line failed to match, oldest tip first. */
	#closeUnmatched(): void {
		if (this.#allClosed) return;

		while (this.#oldTip !== this.#lastMatched) {
			let parent = this.#oldTip.parent;
			this.#finalize(this.#oldTip);
			if (!parent) break;
			this.#oldTip = parent;
		}

		this.#allClosed = true;
	}

	/**
	 * Closes one block and runs whatever its kind owes the tree.
	 *
	 * @param node - The block to close
	 */
	#finalize(node: OpenNode): void {
		let parent = node.parent;
		node.open = false;
		this.#finalizeNode(node);
		if (parent) this.#tip = parent;
	}

	/**
	 * The per-kind work a closing block does: definitions leave the tree, literals
	 * are joined, and this dialect's alerts and task items are recognized from the
	 * first block a container holds.
	 *
	 * @param node - The block being closed
	 */
	#finalizeNode(node: OpenNode): void {
		if (node.pending) {
			this.#fail("An annotation must be followed by a block", node.pending.position);
		}

		if (node.type === "paragraph") this.#finalizeParagraph(node);
		else if (node.type === "code") this.#finalizeCode(node);
		else if (node.type === "html") node.content = joinChunks(trimBlankChunks(node.chunks));
		else if (node.type === "list") finalizeList(node);
		else if (node.type === "listItem") finalizeItem(node);
		else if (node.type === "blockquote") finalizeBlockquote(node);
		else if (node.type === "tag") this.#finalizeTag(node);
	}

	/** A paragraph made only of definitions leaves nothing behind in the tree. */
	#finalizeParagraph(node: OpenNode): void {
		this.#stripDefinitions(node);

		if (node.chunks.length === 0) {
			if (node.parent) node.parent.children = node.parent.children.filter((c) => c !== node);
			return;
		}

		node.start = pointOf(node.chunks[0]);
	}

	/**
	 * Takes every definition off the front of a paragraph and into the document's
	 * map. The first definition of a label wins, so a later duplicate is dropped
	 * rather than replacing the one a reader above it already resolved against.
	 *
	 * @param node - The paragraph to read
	 */
	#stripDefinitions(node: OpenNode): void {
		while (node.chunks.length > 0) {
			let text = new SourceText(node.chunks).value;
			if (text.charAt(0) !== "[") break;

			let definition = readDefinition(text, 0);
			if (!definition) break;

			let key = normalizeLabel(definition.label);
			if (!this.#references.has(key)) {
				this.#references.set(key, {
					href: definition.href,
					...(definition.title === undefined ? {} : { title: definition.title }),
				});
			}

			let consumed =
				definition.end >= text.length
					? node.chunks.length
					: countLines(text.slice(0, definition.end));

			node.chunks = node.chunks.slice(consumed);
		}
	}

	/**
	 * A fence keeps its info string as the first line it collected, read back
	 * here. The node holds the whole string, escapes resolved, and a renderer
	 * decides how much of it names a language.
	 */
	#finalizeCode(node: OpenNode): void {
		if (!node.fenced) {
			node.content = joinChunks(trimBlankChunks(node.chunks));
			return;
		}

		let info = node.chunks.shift()?.text.trim() ?? "";
		let annotated = this.#takeTrailingAnnotation(info);

		if (annotated) {
			node.attributes = { ...node.attributes, ...annotated.attributes };
			let language = unescapeString(annotated.text);
			if (language) node.language = language;
		}

		node.content = joinChunks(node.chunks);
	}

	/** A tag that never met its closer reports the line it was opened on. */
	#finalizeTag(node: OpenNode): void {
		if (node.tagClosed) return;
		this.#fail(`Unclosed tag <${node.tagName}>`, this.#tagSpan(node));
	}

	/**
	 * Splits a trailing `{% … %}` off a single-line opener's text.
	 *
	 * @param text - The heading text or fence info string
	 * @returns The text without the annotation and the attributes it held, or `null` on failure
	 */
	#takeTrailingAnnotation(text: string): { text: string; attributes: Markdown.Attributes } | null {
		let index = text.lastIndexOf("{%");
		if (index === -1) return { text, attributes: {} };

		let found = scanAnnotation(text, index);
		if (!found || found.end !== text.length) return { text, attributes: {} };
		if (readVariableName(found.body) !== null) return { text, attributes: {} };

		let parsed = parseAttributeList(found.body, true);
		if (isFailure(parsed)) {
			this.#fail(parsed.error.message, this.#lineSpan());
			return null;
		}

		return { text: text.slice(0, index).replace(TRAILING_SPACE, ""), attributes: parsed.data };
	}

	/**
	 * Records the first failure and keeps it, so the line the document stopped
	 * making sense on is the one reported rather than whatever unwound after it.
	 *
	 * @param message - What the parser could not read
	 * @param position - Where it stopped
	 * @param issues - Issues a schema raised
	 */
	#fail(message: string, position: Markdown.Position, issues?: MarkdownParseError["issues"]): void {
		if (this.#error) return;
		this.#error = new MarkdownParseError(message, {
			position,
			...(issues === undefined ? {} : { issues }),
		});
	}

	/** The innermost block tag still open, which is the one a closer applies to. */
	#innermostTag(): OpenNode | null {
		let node: OpenNode | null = this.#tip;
		while (node && node.type !== "tag") node = node.parent;
		return node;
	}

	/** Whether any open ancestor is a tag of that name, which makes a closer meant for it. */
	#hasOpenTag(name: string): boolean {
		let node: OpenNode | null = this.#tip;
		while (node) {
			if (node.type === "tag" && node.tagName === name) return true;
			node = node.parent;
		}

		return false;
	}

	/** Whether the line holds nothing but whitespace from `index` on. */
	#restIsBlank(index: number): boolean {
		return this.#line.text.slice(index).trim() === "";
	}

	/** Walks past spaces and tabs, expanding tabs to four-column stops as it measures. */
	#findNextNonspace(): void {
		let text = this.#line.text;
		let index = this.#offset;
		let column = this.#column;
		let char = text.charAt(index);

		while (char === " " || char === "\t") {
			if (char === " ") {
				index += 1;
				column += 1;
			} else {
				index += 1;
				column += CODE_INDENT - (column % CODE_INDENT);
			}
			char = text.charAt(index);
		}

		this.#blank = char === "";
		this.#nextNonspace = index;
		this.#nextNonspaceColumn = column;
		this.#indent = column - this.#column;
		this.#indented = this.#indent >= CODE_INDENT;
	}

	/**
	 * Moves past a measured amount of the line. Counting columns lets a tab be
	 * consumed in parts, which is what keeps a tab-indented list item's content
	 * aligned with the columns its marker asked for.
	 *
	 * @param count - How far to move
	 * @param columns - Whether `count` is columns rather than characters
	 */
	#advanceOffset(count: number, columns: boolean): void {
		let text = this.#line.text;
		let remaining = count;

		while (remaining > 0) {
			let char = text.charAt(this.#offset);
			if (char === "") break;

			if (char === "\t") {
				let toTab = CODE_INDENT - (this.#column % CODE_INDENT);

				if (columns) {
					this.#partialTab = toTab > remaining;
					let step = this.#partialTab ? remaining : toTab;
					this.#column += step;
					this.#offset += this.#partialTab ? 0 : 1;
					remaining -= step;
				} else {
					this.#partialTab = false;
					this.#column += toTab;
					this.#offset += 1;
					remaining -= 1;
				}

				continue;
			}

			this.#partialTab = false;
			this.#offset += 1;
			this.#column += 1;
			remaining -= 1;
		}
	}

	/** Jumps to the first non-space character the last measurement found. */
	#advanceNextNonspace(): void {
		this.#offset = this.#nextNonspace;
		this.#column = this.#nextNonspaceColumn;
		this.#partialTab = false;
	}

	/** Hands what is left of the line to the leaf that collects lines. */
	#addLine(): void {
		let index = this.#offset;
		let prefix = "";

		if (this.#partialTab) {
			index += 1;
			prefix = " ".repeat(CODE_INDENT - (this.#column % CODE_INDENT));
		}

		this.#tip.chunks.push(this.#chunkAt(index, prefix + this.#line.text.slice(index)));
	}

	/**
	 * Records whether the line left each open block ending on a blank, which is
	 * the whole of what decides a list's tightness.
	 *
	 * @param container - The deepest block the line matched into
	 */
	#markBlank(container: OpenNode): void {
		let last = lastOf(container.children);
		if (this.#blank && last) last.lastLineBlank = true;

		let blank =
			this.#blank &&
			!(
				container.type === "blockquote" ||
				(container.type === "code" && container.fenced) ||
				(container.type === "listItem" &&
					container.children.length === 0 &&
					container.start.line === this.#line.line)
			);

		let node: OpenNode | null = container;
		while (node) {
			node.lastLineBlank = blank;
			node = node.parent;
		}
	}

	/** Stretches every open block to the end of a line that contributed to it. */
	#extend(): void {
		if (this.#blank) return;

		let point = this.#lineEnd();
		let node: OpenNode | null = this.#tip;

		while (node) {
			node.end = point;
			node = node.parent;
		}
	}

	/**
	 * @param index - Index into the current line's text
	 * @returns Where that character sits in the file
	 */
	#pointAt(index: number): Markdown.Point {
		return {
			line: this.#line.line,
			column: this.#line.columnBase + index,
			offset: this.#line.offset + index,
		};
	}

	/** One past the current line's last character. */
	#lineEnd(): Markdown.Point {
		return this.#pointAt(this.#line.text.length);
	}

	/** The whole of the current line, for a failure that has nothing narrower to point at. */
	#lineSpan(): Markdown.Position {
		return { start: this.#pointAt(this.#nextNonspace), end: this.#lineEnd() };
	}

	/** A tag's opener, falling back to its first character when the opener went unrecorded. */
	#tagSpan(node: OpenNode): Markdown.Position {
		return node.openPosition ?? { start: node.start, end: node.start };
	}

	/**
	 * @param index - Index in the current line where the text begins
	 * @param text - The text to collect
	 * @returns The text, located in the file
	 */
	#chunkAt(index: number, text: string): Chunk {
		return {
			text,
			line: this.#line.line,
			column: this.#line.columnBase + index,
			offset: this.#line.offset + index,
		};
	}

	/**
	 * Builds the tree deepest blocks first, over an explicit stack, so a document
	 * nested thousands of containers deep costs memory rather than call frames.
	 *
	 * @param root - The block whose children to build
	 * @returns The children as AST nodes
	 */
	#buildBlocks(root: OpenNode): Result<Markdown.Block[], Markdown.ParseError> {
		let order: OpenNode[] = [];
		let stack: OpenNode[] = [root];

		while (stack.length > 0) {
			let node = stack.pop();
			if (!node) continue;

			order.push(node);
			for (let child of node.children) stack.push(child);
		}

		let done = new Map<OpenNode, Markdown.Block>();

		for (let index = order.length - 1; index >= 0; index--) {
			let node = order[index];
			if (!node || node === root) continue;

			let built = this.#buildBlock(node, gather(node.children, done));
			if (isFailure(built)) return built;

			done.set(node, built.data);
		}

		return success(gather(root.children, done));
	}

	/**
	 * Turns one closed block into its AST node, reading its inline content on the
	 * way so a reference defined anywhere in the document resolves for it.
	 *
	 * @param node - The closed block
	 * @param children - Its children, already built
	 * @returns The AST node
	 */
	#buildBlock(
		node: OpenNode,
		children: Markdown.Block[],
	): Result<Markdown.Block, Markdown.ParseError> {
		let position = { start: node.start, end: node.end };

		if (node.type === "paragraph" || node.type === "heading") {
			let inlines = this.#inlines(node.chunks);
			if (isFailure(inlines)) return inlines;

			if (node.type === "heading") {
				return success({
					type: "heading",
					level: node.level,
					attributes: node.attributes,
					children: inlines.data,
					position,
				});
			}

			return success({
				type: "paragraph",
				attributes: node.attributes,
				children: inlines.data,
				position,
			});
		}

		if (node.type === "code") {
			return success({
				type: "code",
				...(node.language === undefined ? {} : { language: node.language }),
				content: node.content,
				attributes: node.attributes,
				position,
			});
		}

		if (node.type === "html") {
			return success({ type: "html", value: node.content, attributes: node.attributes, position });
		}

		if (node.type === "thematicBreak") {
			return success({ type: "thematicBreak", attributes: node.attributes, position });
		}

		if (node.type === "listItem") {
			return success({
				type: "listItem",
				...(node.checked === undefined ? {} : { checked: node.checked }),
				attributes: node.attributes,
				children,
				position,
			});
		}

		if (node.type === "list") {
			let data = node.list ?? blankListData(false);

			return success({
				type: "list",
				ordered: data.ordered,
				...(data.ordered ? { start: data.start } : {}),
				tight: data.tight,
				attributes: node.attributes,
				children: children.filter(isListItem),
				position,
			});
		}

		if (node.type === "table") return this.#buildTable(node);
		if (node.type === "tag") return this.#buildTag(node, children);

		if (node.type === "footnoteDefinition") {
			return success({
				type: "footnoteDefinition",
				identifier: node.identifier ?? "",
				attributes: node.attributes,
				children,
				position,
			});
		}

		if (node.alertKind) {
			return success({
				type: "alert",
				kind: node.alertKind,
				attributes: node.attributes,
				children,
				position,
			});
		}

		return success({ type: "blockquote", attributes: node.attributes, children, position });
	}

	/**
	 * A tag's children are blocks or inlines, decided by what its definition declared.
	 *
	 * @param node - The closed tag
	 * @param children - Its block children, already built
	 * @returns The tag as an AST node
	 */
	#buildTag(node: OpenNode, children: Markdown.Block[]): Result<Markdown.Tag, Markdown.ParseError> {
		let position = { start: node.start, end: node.end };
		let name = node.tagName ?? "";

		if (node.tagContent !== "inline") {
			return success({ type: "tag", name, attributes: node.attributes, children, position });
		}

		let inlines = this.#inlines(node.chunks);
		if (isFailure(inlines)) return inlines;

		return success({
			type: "tag",
			name,
			attributes: node.attributes,
			children: inlines.data,
			position,
		});
	}

	/** The header row, then every body row, each padded or cut to the header's width. */
	#buildTable(node: OpenNode): Result<Markdown.Table, Markdown.ParseError> {
		let align = node.align ?? [];
		let rows: Markdown.TableRow[] = [];

		for (let index = 0; index < node.chunks.length; index++) {
			let chunk = node.chunks[index];
			if (!chunk) continue;

			let row = this.#buildRow(chunk, align.length, index === 0);
			if (isFailure(row)) return row;

			rows.push(row.data);
		}

		return success({
			type: "table",
			align,
			attributes: node.attributes,
			children: rows,
			position: { start: node.start, end: node.end },
		});
	}

	/**
	 * @param chunk - The row's line
	 * @param columns - How many cells the header declared
	 * @param header - Whether this is the row above the delimiter
	 * @returns The row as an AST node
	 */
	#buildRow(
		chunk: Chunk,
		columns: number,
		header: boolean,
	): Result<Markdown.TableRow, Markdown.ParseError> {
		let cells = splitCells(chunk.text);
		let end = {
			line: chunk.line,
			column: chunk.column + chunk.text.length,
			offset: chunk.offset + chunk.text.length,
		};
		let children: Markdown.TableCell[] = [];

		for (let index = 0; index < columns; index++) {
			let cell = cells[index];
			let text = new SourceText(
				cell
					? [
							{
								text: cell.text,
								line: chunk.line,
								column: chunk.column + cell.start,
								offset: chunk.offset + cell.start,
							},
						]
					: [],
			);

			let inlines = parseInlines(text, {
				references: this.#references,
				options: this.#options,
			});
			if (isFailure(inlines)) return inlines;

			children.push({
				type: "tableCell",
				attributes: {},
				children: inlines.data,
				position: cell ? text.position(0, cell.text.length) : { start: end, end },
			});
		}

		return success({
			type: "tableRow",
			header,
			attributes: {},
			children,
			position: { start: { line: chunk.line, column: chunk.column, offset: chunk.offset }, end },
		});
	}

	/**
	 * @param chunks - A leaf's collected lines
	 * @returns The inline nodes those lines hold
	 */
	#inlines(chunks: Chunk[]): Result<Markdown.Inline[], Markdown.ParseError> {
		return parseInlines(new SourceText(chunks), {
			references: this.#references,
			options: this.#options,
		});
	}
}

/**
 * @param type - The kind of block to open
 * @param start - Where it begins in the file
 * @returns A block with every field a later phase may read
 */
function createNode(type: OpenType, start: Markdown.Point): OpenNode {
	return {
		type,
		parent: null,
		children: [],
		open: true,
		chunks: [],
		content: "",
		attributes: {},
		pending: null,
		start,
		end: start,
		lastLineBlank: false,
		lastLineChecked: false,
		level: 1,
		fenced: false,
		fenceChar: "",
		fenceLength: 0,
		fenceIndent: 0,
		htmlKind: 0,
		tagClosed: false,
	};
}

/** A list's defaults, before the marker the source wrote fills them in. */
function blankListData(ordered: boolean): ListData {
	return {
		ordered,
		bulletChar: "",
		delimiter: "",
		start: 1,
		padding: 0,
		markerOffset: 0,
		tight: true,
	};
}

/** Whether two markers belong to one list, which is what a change of character ends. */
function listsMatch(left: ListData | undefined, right: ListData): boolean {
	if (!left) return false;
	if (left.ordered !== right.ordered) return false;

	return left.ordered ? left.delimiter === right.delimiter : left.bulletChar === right.bulletChar;
}

/** Whether a block holds other blocks rather than lines of its own. */
function isContainer(node: OpenNode): boolean {
	if (node.type === "tag") return node.tagContent === "blocks";

	return (
		node.type === "document" ||
		node.type === "blockquote" ||
		node.type === "list" ||
		node.type === "listItem" ||
		node.type === "footnoteDefinition"
	);
}

/**
 * @param parent - The block a new one would go inside
 * @param type - The kind of block being opened
 * @returns Whether the parent holds that kind directly
 */
function canContain(parent: OpenNode, type: OpenType): boolean {
	if (parent.type === "list") return type === "listItem";
	if (!isContainer(parent)) return false;

	return type !== "listItem";
}

/** Whether a leaf collects the lines handed to it rather than having its text set outright. */
function acceptsLines(node: OpenNode): boolean {
	if (node.type === "tag") return node.tagContent === "inline";

	return (
		node.type === "paragraph" ||
		node.type === "code" ||
		node.type === "html" ||
		node.type === "table"
	);
}

/** Whether a leaf still lets new blocks start on a line it would otherwise take. */
function opensInsideLeaf(node: OpenNode): boolean {
	return node.type === "paragraph" || node.type === "table";
}

/** A block quote opening with an alert marker is an alert, and drops the marker line. */
function finalizeBlockquote(node: OpenNode): void {
	let first = node.children[0];
	if (!first || first.type !== "paragraph") return;

	let head = first.chunks[0];
	if (!head) return;

	let match = ALERT_MARKER.exec(head.text.trim());
	if (!match) return;

	node.alertKind = (match[1] ?? "").toLowerCase() as Markdown.Alert["kind"];
	first.chunks.shift();

	if (first.chunks.length === 0) {
		node.children.shift();
		return;
	}

	first.start = pointOf(first.chunks[0]);
}

/** An item whose first paragraph opens with a checkbox is a task, and drops the marker. */
function finalizeItem(node: OpenNode): void {
	let first = node.children[0];
	if (!first || first.type !== "paragraph") return;

	let head = first.chunks[0];
	if (!head) return;

	let match = TASK_MARKER.exec(head.text);
	if (!match) return;

	node.checked = (match[1] ?? "").toLowerCase() === "x";
	first.chunks[0] = {
		text: head.text.slice(match[0].length),
		line: head.line,
		column: head.column + match[0].length,
		offset: head.offset + match[0].length,
	};
	first.start = pointOf(first.chunks[0]);
}

/**
 * @param children - The open blocks whose AST nodes to collect
 * @param done - Every block built so far
 * @returns The children as AST nodes, in source order
 */
function gather(children: OpenNode[], done: Map<OpenNode, Markdown.Block>): Markdown.Block[] {
	let blocks: Markdown.Block[] = [];

	for (let child of children) {
		let built = done.get(child);
		if (built) blocks.push(built);
	}

	return blocks;
}

/** Narrows a list's children, which the container rules already keep to items. */
function isListItem(node: Markdown.Block): node is Markdown.ListItem {
	return node.type === "listItem";
}

/**
 * @param chunk - A collected line
 * @returns Where its first character sits in the file
 */
function pointOf(chunk: Chunk | undefined): Markdown.Point {
	return { line: chunk?.line ?? 1, column: chunk?.column ?? 1, offset: chunk?.offset ?? 0 };
}

/** A blank line between two things a list holds is what makes the list loose. */
function finalizeList(node: OpenNode): void {
	let items = node.children;
	let data = node.list;
	if (!data) return;

	for (let index = 0; index < items.length; index++) {
		let item = items[index];
		if (!item) continue;

		if (endsWithBlankLine(item) && index < items.length - 1) {
			data.tight = false;
			return;
		}

		for (let inner = 0; inner < item.children.length; inner++) {
			if (
				endsWithBlankLine(item.children[inner]) &&
				(index < items.length - 1 || inner < item.children.length - 1)
			) {
				data.tight = false;
				return;
			}
		}
	}
}

/** Whether a block, or the last thing nested inside it, ended on a blank line. */
function endsWithBlankLine(node: OpenNode | undefined): boolean {
	let current = node;

	while (current) {
		if (current.lastLineBlank) return true;

		if (!current.lastLineChecked && (current.type === "list" || current.type === "listItem")) {
			current.lastLineChecked = true;
			current = lastOf(current.children);
			continue;
		}

		current.lastLineChecked = true;
		return false;
	}

	return false;
}

/** A literal block ends with a newline when it holds anything at all. */
function joinChunks(chunks: Chunk[]): string {
	if (chunks.length === 0) return "";

	return `${chunks.map((chunk) => chunk.text).join("\n")}\n`;
}

/** Trailing blank lines belong to the document, not to the literal block above them. */
function trimBlankChunks(chunks: Chunk[]): Chunk[] {
	let end = chunks.length;
	while (end > 0 && (chunks[end - 1]?.text.trim() ?? "") === "") end -= 1;

	return chunks.slice(0, end);
}

/**
 * @param text - Any text
 * @returns How many lines it spans past the first
 */
function countLines(text: string): number {
	let count = 0;
	for (let index = 0; index < text.length; index++) {
		if (text.charAt(index) === "\n") count += 1;
	}

	return count;
}

/** Whether a character is one of the two the block phase measures indentation with. */
function isSpaceOrTab(char: string): boolean {
	return char === " " || char === "\t";
}

/**
 * @param items - Any array
 * @returns Its last entry, or nothing when it is empty
 */
function lastOf<T>(items: T[]): T | undefined {
	return items[items.length - 1];
}
