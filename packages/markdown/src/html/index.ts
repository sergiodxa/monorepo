/**
 * Renders a parsed document as static HTML, for a feed item, an email body, or
 * any response that carries markup rather than a component tree. Elements are
 * plain and semantic, and `md-` classes mark what HTML has no element for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../index.js";

/** Builds the markup for one registered tag, given its children already rendered. */
export type HTMLTagRenderer = (tag: {
	name: string;
	attributes: Markdown.Attributes;
	children: string;
}) => string;

/** Options for {@link toHTML}. */
export interface HTMLOptions {
	/** Keyed by tag name; a tag with no renderer contributes its children alone. */
	tags?: Record<string, HTMLTagRenderer>;
}

/**
 * Node types that open a block of their own, which is what tells a tag wrapped
 * around paragraphs apart from one written inside a sentence.
 */
const BLOCK_TYPES: ReadonlySet<string> = new Set([
	"alert",
	"blockquote",
	"code",
	"document",
	"footnoteDefinition",
	"heading",
	"html",
	"list",
	"listItem",
	"paragraph",
	"table",
	"tableCell",
	"tableRow",
	"thematicBreak",
]);

/** One attribute of an element, `true` standing for the bare form a boolean takes. */
interface HTMLAttribute {
	name: string;
	value: string | true;
}

/**
 * Travels with the recursion so a footnote reference draws the number its
 * definition holds in the trailing list, which is a fact only the root knows.
 */
interface Context {
	options: HTMLOptions;
	footnotes: ReadonlyMap<string, number>;
}

/**
 * @param node - Any node, so a caller can render a fragment of a document
 * @param options - Markup for the tags the document uses
 * @returns HTML for that subtree, with no wrapper element of its own
 * @example toHTML(document)
 */
export function toHTML(node: Markdown.Node, options: HTMLOptions = {}): string {
	return renderNode(node, { options, footnotes: numberFootnotes(node) });
}

/**
 * The recursion every other helper goes through, so one place decides what each
 * node type becomes and a fragment renders exactly as it would in place.
 */
function renderNode(node: Markdown.Node, context: Context): string {
	switch (node.type) {
		case "document": {
			return joinBlocks([renderBlocks(node.children, context), renderFootnotes(node, context)]);
		}

		case "heading": {
			let attributes = elementAttributes(node.attributes);
			return `<h${node.level}${attributes}>${renderInline(node.children, context)}</h${node.level}>`;
		}

		case "paragraph":
			return `<p${elementAttributes(node.attributes)}>${renderInline(node.children, context)}</p>`;

		case "code":
			return renderCode(node);

		case "list":
			return renderList(node, context);

		case "listItem":
			return renderListItem(node, context);

		case "blockquote":
			return `<blockquote${elementAttributes(node.attributes)}>${renderBlocks(node.children, context)}</blockquote>`;

		case "alert": {
			let attributes = elementAttributes(
				node.attributes,
				["md-alert", `md-alert-${node.kind}`],
				[{ name: "data-kind", value: node.kind }],
			);
			return `<aside${attributes}>${renderBlocks(node.children, context)}</aside>`;
		}

		case "table":
			return renderTable(node, context);

		case "tableRow":
			return renderRow(node, [], context);

		case "tableCell":
			return renderCell(node, false, null, context);

		case "thematicBreak":
			return `<hr${elementAttributes(node.attributes)} />`;

		case "html":
		case "inlineHtml":
			return escapeText(node.value);

		case "footnoteDefinition":
			return "";

		case "tag":
			return renderTag(node, context);

		case "text":
			return escapeText(node.value);

		case "emphasis":
			return `<em>${renderInline(node.children, context)}</em>`;

		case "strong":
			return `<strong>${renderInline(node.children, context)}</strong>`;

		case "strikethrough":
			return `<del>${renderInline(node.children, context)}</del>`;

		case "inlineCode":
			return `<code>${escapeText(node.value)}</code>`;

		case "link": {
			let attributes = renderAttributes([
				{ name: "href", value: node.href },
				...titleAttribute(node.title),
			]);
			return `<a${attributes}>${renderInline(node.children, context)}</a>`;
		}

		case "image": {
			let attributes = renderAttributes([
				{ name: "src", value: node.src },
				{ name: "alt", value: plainText(node.children) },
				...titleAttribute(node.title),
			]);
			return `<img${attributes} />`;
		}

		case "softBreak":
			return "\n";

		case "hardBreak":
			return "<br />";

		case "footnoteReference":
			return renderFootnoteReference(node, context);

		case "variable":
			return `<span class="md-variable">{% $${escapeText(node.name)} %}</span>`;
	}
}

/** Blocks read as their own lines, which is what makes a response body legible. */
function renderBlocks(nodes: readonly Markdown.Node[], context: Context): string {
	return joinBlocks(nodes.map((child) => renderNode(child, context)));
}

/** A sentence closes back up over its parts, so an inline run carries no separator. */
function renderInline(nodes: readonly Markdown.Node[], context: Context): string {
	return nodes.map((child) => renderNode(child, context)).join("");
}

/** A node that renders to nothing leaves no blank line behind it. */
function joinBlocks(parts: readonly string[]): string {
	return parts.filter((part) => part.length > 0).join("\n");
}

/** A node's children, or nothing for the leaves that hold a value instead. */
function childrenOf(node: Markdown.Node): readonly Markdown.Node[] {
	if ("children" in node) return node.children;
	return [];
}

/**
 * Text lands in a document where `&` and the angle brackets mean markup, so all
 * three leave as entities and a stray `<div>` shows as the author wrote it.
 */
function escapeText(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** An attribute value sits inside quotes, which is one more character to spend. */
function escapeAttribute(value: string): string {
	return escapeText(value).replaceAll('"', "&quot;");
}

/** Writes a list in order, the bare form standing for an attribute that is simply present. */
function renderAttributes(list: readonly HTMLAttribute[]): string {
	return list
		.map((attribute) => {
			if (attribute.value === true) return ` ${attribute.name}`;
			return ` ${attribute.name}="${escapeAttribute(attribute.value)}"`;
		})
		.join("");
}

/**
 * Carries an annotation into the markup: `id` names the element, `class` joins
 * whatever the element already answers to, and every other key becomes a `data-`
 * attribute a stylesheet or a script can select on.
 */
function elementAttributes(
	attributes: Markdown.Attributes,
	classes: readonly string[] = [],
	extra: readonly HTMLAttribute[] = [],
): string {
	let list: HTMLAttribute[] = [];
	let names = [...classes];

	if (typeof attributes.class === "string" && attributes.class.length > 0) {
		names.push(attributes.class);
	}
	if (names.length > 0) list.push({ name: "class", value: names.join(" ") });

	if (typeof attributes.id === "string" || typeof attributes.id === "number") {
		list.push({ name: "id", value: String(attributes.id) });
	}

	list.push(...extra);

	for (let [key, value] of Object.entries(attributes)) {
		if (key === "class" || key === "id") continue;
		if (value === false) continue;
		if (value === true) {
			list.push({ name: `data-${kebabCase(key)}`, value: true });
			continue;
		}
		list.push({ name: `data-${kebabCase(key)}`, value: String(value) });
	}

	return renderAttributes(list);
}

/** An annotation writes the key an author types, and a `data-` attribute spells it in dashes. */
function kebabCase(key: string): string {
	return key
		.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replaceAll(/[\s_]+/g, "-")
		.toLowerCase();
}

/** A title is optional on both the nodes that carry one, and empty means absent. */
function titleAttribute(title: string | undefined): HTMLAttribute[] {
	if (title === undefined) return [];
	return [{ name: "title", value: title }];
}

/**
 * The class a stylesheet keys on is the language alone, while the node holds the
 * whole info string the fence was opened with.
 */
function languageClass(language: string | undefined): string | undefined {
	if (language === undefined) return undefined;
	let first = language.trim().split(/\s+/u)[0];
	if (first === undefined || first.length === 0) return undefined;
	return first;
}

/**
 * Draws a fence, keeping every character between `<pre>` and `</pre>` part of
 * the source, since whitespace there is content rather than formatting.
 */
function renderCode(node: Markdown.Code): string {
	let language = languageClass(node.language);
	let classes = language ? ["md-code", `language-${language}`] : ["md-code"];
	let attributes = elementAttributes(node.attributes, classes);
	let inner = language ? ` class="language-${escapeAttribute(language)}"` : "";
	return `<pre${attributes}><code${inner}>${renderCodeBody(node)}</code></pre>`;
}

/** Painted runs become the spans a token stylesheet colours; unpainted source stays text. */
function renderCodeBody(node: Markdown.Code): string {
	let tokens = codeTokens(node);
	if (tokens.length === 0) return escapeText(node.content);

	return tokens
		.map((token) => {
			if (token.type === "plain") return escapeText(token.value);
			return `<span class="token ${escapeAttribute(token.type)}">${escapeText(token.value)}</span>`;
		})
		.join("");
}

/** One painted run of source, shaped structurally so a document painted elsewhere renders here. */
interface CodeToken {
	type: string;
	value: string;
}

/**
 * Painted runs ride on the node as a field another package attaches, so they are
 * read as unknown and narrowed here, which keeps this entry point free of a
 * syntax highlighter.
 */
function codeTokens(node: Markdown.Code): CodeToken[] {
	let tokens = (node as { tokens?: unknown }).tokens;
	if (!Array.isArray(tokens)) return [];
	return tokens.filter(isToken);
}

/** Guards the painted runs, so a malformed field draws the raw source instead of throwing. */
function isToken(value: unknown): value is CodeToken {
	if (typeof value !== "object" || value === null) return false;
	let candidate = value as { type?: unknown; value?: unknown };
	return typeof candidate.type === "string" && typeof candidate.value === "string";
}

/** The counter a reader sees belongs to the ordered list, and `start` is where the source put it. */
function renderList(node: Markdown.List, context: Context): string {
	let items = renderBlocks(node.children, context);

	if (node.ordered) {
		let start: HTMLAttribute[] =
			typeof node.start === "number" ? [{ name: "start", value: String(node.start) }] : [];
		return `<ol${elementAttributes(node.attributes, [], start)}>${items}</ol>`;
	}

	return `<ul${elementAttributes(node.attributes)}>${items}</ul>`;
}

/** A task item states its state in a control a reader recognizes and cannot change. */
function renderListItem(node: Markdown.ListItem, context: Context): string {
	let children = renderBlocks(node.children, context);

	if (typeof node.checked !== "boolean") {
		return `<li${elementAttributes(node.attributes)}>${children}</li>`;
	}

	let checked = node.checked ? " checked" : "";
	let box = `<input class="md-task-box" type="checkbox" disabled${checked}>`;
	return `<li${elementAttributes(node.attributes, ["md-task"])}>${box}${children}</li>`;
}

/**
 * Splits the rows at the one the delimiter row marked, so the header lands in a
 * `<thead>` and everything else in a `<tbody>`.
 */
function renderTable(node: Markdown.Table, context: Context): string {
	let header = node.children.filter((row) => row.header);
	let body = node.children.filter((row) => !row.header);
	let sections: string[] = [];

	if (header.length > 0) {
		let rows = joinBlocks(header.map((row) => renderRow(row, node.align, context)));
		sections.push(`<thead>${rows}</thead>`);
	}

	if (body.length > 0) {
		let rows = joinBlocks(body.map((row) => renderRow(row, node.align, context)));
		sections.push(`<tbody>${rows}</tbody>`);
	}

	return `<table${elementAttributes(node.attributes, ["md-table"])}>${joinBlocks(sections)}</table>`;
}

/** Each cell takes the alignment of the column it sits in, which the table carries once. */
function renderRow(
	node: Markdown.TableRow,
	align: Markdown.Table["align"],
	context: Context,
): string {
	let cells = node.children
		.map((cell, index) => renderCell(cell, node.header, align[index] ?? null, context))
		.join("");

	return `<tr${elementAttributes(node.attributes)}>${cells}</tr>`;
}

/** A header row's cells are the table's column headings, so they are marked as such. */
function renderCell(
	node: Markdown.TableCell,
	header: boolean,
	align: "left" | "center" | "right" | null,
	context: Context,
): string {
	let name = header ? "th" : "td";
	let classes = align ? [`md-align-${align}`] : [];
	let attributes = elementAttributes(node.attributes, classes);
	return `<${name}${attributes}>${renderInline(node.children, context)}</${name}>`;
}

/** A tag with no renderer drops its chrome and keeps the content the author wrote. */
function renderTag(node: Markdown.Tag, context: Context): string {
	let children = renderTagChildren(node, context);
	let renderer = context.options.tags?.[node.name];
	if (!renderer) return children;
	return renderer({ name: node.name, attributes: node.attributes, children });
}

/** What a tag was written around decides whether its children read as lines or as a sentence. */
function renderTagChildren(node: Markdown.Tag, context: Context): string {
	let [first] = node.children;
	if (first && BLOCK_TYPES.has(first.type)) return renderBlocks(node.children, context);
	return renderInline(node.children, context);
}

/** Numbering is the document's to assign, so a fragment draws the identifier it was given. */
function renderFootnoteReference(node: Markdown.FootnoteReference, context: Context): string {
	let number = context.footnotes.get(node.identifier);
	let label = number === undefined ? node.identifier : String(number);
	let id = escapeAttribute(node.identifier);
	return `<sup class="md-footnote-ref"><a id="md-fnref-${id}" href="#md-fn-${id}">${escapeText(label)}</a></sup>`;
}

/**
 * Draws every definition the document holds as one trailing section, which is
 * where a footnote belongs however deep in the prose its body was written.
 */
function renderFootnotes(node: Markdown.Document, context: Context): string {
	let definitions = collectFootnotes(node, []);
	if (definitions.length === 0) return "";

	let items = definitions.map((definition) => {
		let identifier = escapeAttribute(definition.identifier);
		let attributes = elementAttributes({
			...definition.attributes,
			id: `md-fn-${definition.identifier}`,
		});
		let back = `<a class="md-footnote-back" href="#md-fnref-${identifier}">↩</a>`;
		return `<li${attributes}>${renderBlocks(definition.children, context)}${back}</li>`;
	});

	return `<section class="md-footnotes"><ol class="md-footnote-list">${joinBlocks(items)}</ol></section>`;
}

/** A reference draws the place its definition takes in the trailing list. */
function numberFootnotes(node: Markdown.Node): ReadonlyMap<string, number> {
	let numbers = new Map<string, number>();
	if (node.type !== "document") return numbers;

	let definitions = collectFootnotes(node, []);
	for (let [index, definition] of definitions.entries()) {
		numbers.set(definition.identifier, index + 1);
	}

	return numbers;
}

/** Gathers definitions in document order, so the trailing list reads the way the source wrote it. */
function collectFootnotes(
	node: Markdown.Node,
	found: Markdown.FootnoteDefinition[],
): Markdown.FootnoteDefinition[] {
	if (node.type === "footnoteDefinition") {
		found.push(node);
		return found;
	}

	for (let child of childrenOf(node)) collectFootnotes(child, found);
	return found;
}

/** An image's alternative text is inline content in the source and an attribute in the markup. */
function plainText(nodes: readonly Markdown.Node[]): string {
	return nodes.map(textOf).join("");
}

/** Reads the prose out of one node, breaks becoming the space they stand for. */
function textOf(node: Markdown.Node): string {
	if (node.type === "text" || node.type === "inlineCode" || node.type === "inlineHtml") {
		return node.value;
	}
	if (node.type === "softBreak" || node.type === "hardBreak") return " ";
	if (node.type === "variable") return `{% $${node.name} %}`;
	return plainText(childrenOf(node));
}
