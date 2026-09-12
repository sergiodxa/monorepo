/**
 * GitHub Flavored Markdown as a format: read a document into a plain-data AST,
 * transform it with a visitor, and write it back out. The tree is JSON, so a
 * parsed document caches, travels in a payload, and type-checks at every hop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { parseDocument, parseFrontmatter } from "./lib/parse.js";
import { stringifyDocument } from "./lib/stringify.js";
import { walkNode } from "./lib/walk.js";

export { MarkdownParseError, MarkdownStringifyError, MarkdownWalkError } from "./lib/errors.js";

/**
 * Reads and writes GitHub Flavored Markdown. Every entry is static and the
 * constructor is private, so the name is a namespace the compiler enforces
 * rather than a shape a caller could try to construct.
 */
export class Markdown {
	/** Nothing here holds state, so there is nothing to construct. */
	private constructor() {}

	/**
	 * Reads the frontmatter block and the body in one traversal of the source.
	 * Positions on every node index the file as written, frontmatter included,
	 * so a failure names the line an author has to open.
	 *
	 * @param source - Markdown source, with or without a frontmatter block
	 * @param options - Frontmatter schema and the tags the document may use
	 * @returns The validated frontmatter and the parsed document
	 * @example Markdown.parse(source, { frontmatter: Frontmatter })
	 */
	static parse<Schema extends StandardSchemaV1>(
		source: string,
		options: Markdown.Options<Schema> & { frontmatter: Schema },
	): Result<Markdown.Parsed<StandardSchemaV1.InferOutput<Schema>>, Markdown.ParseError>;
	static parse(
		source: string,
		options?: Markdown.Options,
	): Result<Markdown.Parsed<unknown>, Markdown.ParseError>;
	static parse(
		source: string,
		options: Markdown.Options = {},
	): Result<Markdown.Parsed<unknown>, Markdown.ParseError> {
		return parseDocument(source, options);
	}

	/**
	 * Reads the frontmatter block and stops, leaving the body unparsed, so an
	 * index over a hundred posts costs a hundred small reads instead of a
	 * hundred documents.
	 *
	 * @param source - Markdown source, with or without a frontmatter block
	 * @param options - The same options {@link Markdown.parse} takes; only the schema is read
	 * @returns The validated frontmatter
	 * @example Markdown.frontmatter(source, { frontmatter: Frontmatter })
	 */
	static frontmatter<Schema extends StandardSchemaV1>(
		source: string,
		options: Markdown.Options<Schema> & { frontmatter: Schema },
	): Result<Markdown.Frontmatter<StandardSchemaV1.InferOutput<Schema>>, Markdown.ParseError>;
	static frontmatter(
		source: string,
		options?: Markdown.Options,
	): Result<Markdown.Frontmatter<unknown>, Markdown.ParseError>;
	static frontmatter(
		source: string,
		options: Markdown.Options = {},
	): Result<Markdown.Frontmatter<unknown>, Markdown.ParseError> {
		return parseFrontmatter(source, options);
	}

	/**
	 * Writes a document back as markdown, normalized rather than reproduced, so
	 * a second parse of the output yields the same tree. Only the frontmatter
	 * branch can fail, when a value is one YAML cannot write.
	 *
	 * @param document - The document to serialize
	 * @param options - Frontmatter to prepend as a YAML block
	 * @returns The markdown source
	 * @example Markdown.stringify(document, { frontmatter })
	 */
	static stringify(
		document: Markdown.Document,
		options: Markdown.StringifyOptions = {},
	): Result<string, Markdown.StringifyError> {
		return stringifyDocument(document, options);
	}

	/**
	 * Rewrites a tree through a visitor, returning a new node and sharing every
	 * subtree no handler touched. A handler that throws lands on the failure
	 * branch carrying the position it was standing on.
	 *
	 * @param node - The node to walk, which the result is returned as
	 * @param visitor - Handlers keyed by node type
	 * @returns The rewritten node, wrapped in a promise when a handler is asynchronous
	 * @example Markdown.walk(document, { code: () => null })
	 */
	static walk<N extends Markdown.Node, V extends Markdown.Visitor>(
		node: N,
		visitor: V,
	): Markdown.Walked<V, N> {
		return walkNode(node, visitor) as Markdown.Walked<V, N>;
	}
}

/**
 * The document shape, the options every entry reads, and the visitor contract.
 * Declared beside the class so one name carries the format and its types, and
 * so another package can attach a field of its own through augmentation.
 */
export namespace Markdown {
	/** 1-based line and column, 0-based offset, all into the source as written, frontmatter included. */
	export interface Point {
		line: number;
		column: number;
		offset: number;
	}

	/** Where a node begins and ends. `end` is exclusive, so it points one past the last character. */
	export interface Position {
		start: Point;
		end: Point;
	}

	/**
	 * Literal values only. `#id` writes `id`, `.a .b` writes `class: "a b"`, a bare key
	 * writes `true`, and `{42}` and `{true}` write the number and the boolean.
	 */
	export type Attributes = Record<string, string | number | boolean>;

	/** The root. It belongs to neither category, so a `Block[]` can never hold one. */
	export interface Document {
		type: "document";
		children: Block[];
		position: Position;
	}

	/** `level` is what the source wrote, ATX or setext alike. */
	export interface Heading {
		type: "heading";
		level: 1 | 2 | 3 | 4 | 5 | 6;
		attributes: Attributes;
		children: Inline[];
		position: Position;
	}

	export interface Paragraph {
		type: "paragraph";
		attributes: Attributes;
		children: Inline[];
		position: Position;
	}

	/** Fenced or indented. Indented code has no `language` and empty `attributes`. */
	export interface Code {
		type: "code";
		language?: string;
		content: string;
		attributes: Attributes;
		position: Position;
	}

	/** `tight` says the source left no blank line between items, which decides how items render. */
	export interface List {
		type: "list";
		ordered: boolean;
		start?: number;
		tight: boolean;
		attributes: Attributes;
		children: ListItem[];
		position: Position;
	}

	/** `checked` is present only on a task list item, and says which box the source drew. */
	export interface ListItem {
		type: "listItem";
		checked?: boolean;
		attributes: Attributes;
		children: Block[];
		position: Position;
	}

	export interface Blockquote {
		type: "blockquote";
		attributes: Attributes;
		children: Block[];
		position: Position;
	}

	/** A GitHub alert, carrying its kind so a renderer draws one without reading its first line. */
	export interface Alert {
		type: "alert";
		kind: "note" | "tip" | "important" | "warning" | "caution";
		attributes: Attributes;
		children: Block[];
		position: Position;
	}

	/** `align` has one entry per column, `null` where the delimiter row asked for nothing. */
	export interface Table {
		type: "table";
		align: Array<"left" | "center" | "right" | null>;
		attributes: Attributes;
		children: TableRow[];
		position: Position;
	}

	/** `header` marks the one row above the delimiter, which is the only header a GFM table has. */
	export interface TableRow {
		type: "tableRow";
		header: boolean;
		attributes: Attributes;
		children: TableCell[];
		position: Position;
	}

	export interface TableCell {
		type: "tableCell";
		attributes: Attributes;
		children: Inline[];
		position: Position;
	}

	export interface ThematicBreak {
		type: "thematicBreak";
		attributes: Attributes;
		position: Position;
	}

	/** Raw HTML, held as the source text it was written as. Renderers show it escaped. */
	export interface Html {
		type: "html";
		value: string;
		attributes: Attributes;
		position: Position;
	}

	/** The body of a footnote. Its `identifier` is what a {@link FootnoteReference} points at. */
	export interface FootnoteDefinition {
		type: "footnoteDefinition";
		identifier: string;
		attributes: Attributes;
		children: Block[];
		position: Position;
	}

	/** A registered element. Its `children` say whether the source wrote it block-level or inline. */
	export interface Tag {
		type: "tag";
		name: string;
		attributes: Attributes;
		/** Parsed as markdown, so a tag's children are nodes, not a string. */
		children: Block[] | Inline[];
		position: Position;
	}

	export interface Text {
		type: "text";
		value: string;
		position: Position;
	}

	export interface Emphasis {
		type: "emphasis";
		children: Inline[];
		position: Position;
	}

	export interface Strong {
		type: "strong";
		children: Inline[];
		position: Position;
	}

	export interface Strikethrough {
		type: "strikethrough";
		children: Inline[];
		position: Position;
	}

	export interface InlineCode {
		type: "inlineCode";
		value: string;
		position: Position;
	}

	/** A bracketed link, an autolink, and a bare URL all land here; a reference resolves before it does. */
	export interface Link {
		type: "link";
		href: string;
		title?: string;
		children: Inline[];
		position: Position;
	}

	/** `children` hold the alternative text, which is inline content in the source. */
	export interface Image {
		type: "image";
		src: string;
		title?: string;
		children: Inline[];
		position: Position;
	}

	export interface SoftBreak {
		type: "softBreak";
		position: Position;
	}

	export interface HardBreak {
		type: "hardBreak";
		position: Position;
	}

	/** Raw inline HTML, held as the source text it was written as. Renderers show it escaped. */
	export interface InlineHtml {
		type: "inlineHtml";
		value: string;
		position: Position;
	}

	/** Points at a {@link FootnoteDefinition}, which a renderer draws somewhere else. */
	export interface FootnoteReference {
		type: "footnoteReference";
		identifier: string;
		position: Position;
	}

	/** A `{% $name %}` hole. Nothing is substituted at parse time, so one parse serves every render. */
	export interface Variable {
		type: "variable";
		name: string;
		position: Position;
	}

	export type Block =
		| Heading
		| Paragraph
		| Code
		| List
		| ListItem
		| Blockquote
		| Alert
		| Table
		| TableRow
		| TableCell
		| ThematicBreak
		| Html
		| FootnoteDefinition
		| Tag;

	export type Inline =
		| Text
		| Emphasis
		| Strong
		| Strikethrough
		| InlineCode
		| Link
		| Image
		| SoftBreak
		| HardBreak
		| InlineHtml
		| FootnoteReference
		| Variable
		| Tag;

	export type Node = Document | Block | Inline;

	export type Parent = Extract<Node, { children: unknown[] }>;

	/**
	 * What a registered tag contains, which is the one question the parser has to
	 * answer before reading what follows the opening tag.
	 */
	export interface TagDefinition {
		/** @default "blocks" */
		content?: "blocks" | "inline" | "none";
		/** Validated against the opening tag, so a bad attribute is a parse error with a line. */
		attributes?: StandardSchemaV1;
	}

	/** Read by both {@link Markdown.parse} and {@link Markdown.frontmatter}, so an app hoists one object. */
	export interface Options<Schema extends StandardSchemaV1 = StandardSchemaV1> {
		frontmatter?: Schema;
		/** Only these names become tags; anything else stays raw HTML, as GitHub treats it. */
		tags?: Record<string, TagDefinition>;
	}

	export interface StringifyOptions {
		/** Written as a YAML block ahead of the body. Omitting it writes the body alone. */
		frontmatter?: unknown;
	}

	export interface Parsed<FM> {
		frontmatter: FM;
		document: Document;
	}

	export interface Frontmatter<FM> {
		frontmatter: FM;
	}

	/** The category a node of type `K` belongs to; `tag` belongs to both. */
	type Category<K extends Node["type"]> =
		| (K extends Block["type"] ? Block : never)
		| (K extends Inline["type"] ? Inline : never)
		| (K extends "document" ? Document : never);

	/** What a handler for a node of type `K` may return, which is what decides the node's fate. */
	export type Visited<K extends Node["type"]> = Category<K> | Category<K>[] | null | undefined;

	/** One optional handler per node type; a type with no handler is passed through untouched. */
	export type Visitor = {
		[K in Node["type"]]?: (
			node: Extract<Node, { type: K }>,
			parent: Parent | null,
		) => Visited<K> | Promise<Visited<K>>;
	};

	/** Every return type the visitor's own handlers declare, which is what decides the walk's shape. */
	type HandlerReturn<V extends Visitor> = {
		[K in keyof V]: NonNullable<V[K]> extends (...args: never[]) => infer R ? R : never;
	}[keyof V];

	/** A `Result` when no handler can return a promise; a `Promise` of one otherwise. */
	export type Walked<V extends Visitor, N extends Node = Document> = [
		Extract<HandlerReturn<V>, Promise<unknown>>,
	] extends [never]
		? Result<N, WalkError>
		: Promise<Result<N, WalkError>>;

	/** Named here so the class's signatures read in one vocabulary. */
	export type ParseError = import("./lib/errors.js").MarkdownParseError;
	export type StringifyError = import("./lib/errors.js").MarkdownStringifyError;
	export type WalkError = import("./lib/errors.js").MarkdownWalkError;
}
