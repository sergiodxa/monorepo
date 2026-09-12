/**
 * Writes inline nodes back as source, tracking where each run lands so the text
 * escaper knows whether it opens a line. Links and code spans take one normalized
 * spelling each, and emphasis takes the delimiter its neighbours leave room for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../../index.js";

import { writeAttributes } from "./attributes.js";
import { escapeText, longestRun } from "./escape.js";

/** Characters that stop `_` from emphasizing, being neither whitespace nor punctuation. */
const INTRAWORD = /[^\s\p{P}\p{S}]/u;

/** What the inline writer needs to know about the block it is filling. */
export interface InlineContext {
	/** Whether the run sits in a table cell, where `|` escapes and a break becomes a space. */
	table: boolean;
}

/** A written node, or an emphasis still waiting on its neighbours to settle its delimiter. */
interface Part {
	/** The node as written, standing in with a single delimiter while an emphasis waits. */
	text: string;
	/** The emphasis whose body is written once the delimiter around it is known. */
	emphasis?: Markdown.Emphasis;
}

/**
 * Reads the delimiter an emphasis takes, preferring `_` because that is the spelling
 * markdown is formatted to here, and taking `*` where flanking would leave the
 * underscores as literal text or merge them into a strong run.
 *
 * @param before - The character the opening delimiter lands against
 * @param after - The character the closing delimiter lands against
 * @returns The delimiter to write on both sides
 */
function emphasisDelimiter(before: string, after: string): string {
	if (before === "_" || after === "_") return "*";
	if (INTRAWORD.test(before) || INTRAWORD.test(after)) return "*";

	return "_";
}

/**
 * Writes a run of inline nodes.
 *
 * @param nodes - The nodes to write
 * @param context - The block the run is filling
 * @param lineStart - Whether the run opens a line, which the first node inherits
 * @param underscored - Whether an emphasis written with `_` encloses the run
 * @returns The inline source
 * @example stringifyInlines(paragraph.children, { table: false }, true)
 */
export function stringifyInlines(
	nodes: Markdown.Inline[],
	context: InlineContext,
	lineStart: boolean,
	underscored = false,
): string {
	let parts: Part[] = [];
	let written = "";

	for (let node of nodes) {
		let opens = written === "" ? lineStart : written.endsWith("\n");
		let part: Part =
			node.type === "emphasis"
				? { emphasis: node, text: "*" }
				: { text: stringifyInline(node, context, opens) };

		parts.push(part);
		written += part.text;
	}

	let edge = underscored ? "_" : "";
	let out = "";

	for (let [index, part] of parts.entries()) {
		if (part.emphasis === undefined) {
			out += part.text;
			continue;
		}

		let before = out.charAt(out.length - 1) || edge;
		let after = (parts[index + 1]?.text ?? "").charAt(0) || edge;
		let delimiter = emphasisDelimiter(before, after);
		let body = stringifyInlines(part.emphasis.children, context, false, delimiter === "_");

		out += `${delimiter}${body}${delimiter}`;
	}

	return out;
}

/** One inline node, given whether it opens a line so a `text` node escapes accordingly. */
function stringifyInline(
	node: Exclude<Markdown.Inline, { type: "emphasis" }>,
	context: InlineContext,
	lineStart: boolean,
): string {
	switch (node.type) {
		case "text":
			return escapeText(node.value, { lineStart, table: context.table });
		case "strong":
			return `**${stringifyInlines(node.children, context, false)}**`;
		case "strikethrough":
			return `~~${stringifyInlines(node.children, context, false)}~~`;
		case "inlineCode":
			return writeInlineCode(node.value);
		case "link":
			return writeLink(node, context);
		case "image":
			return `![${stringifyInlines(node.children, context, false)}](${writeDestination(node.src, node.title)})`;
		case "softBreak":
			return context.table ? " " : "\n";
		case "hardBreak":
			return context.table ? " " : "\\\n";
		case "inlineHtml":
			return node.value;
		case "footnoteReference":
			return `[^${node.identifier}]`;
		case "variable":
			return `{% $${node.name} %}`;
		case "tag":
			return writeTag(node, context);
	}
}

/**
 * A code span whose fence outruns every backtick inside it, padded with one space
 * on each side where the content would otherwise be eaten by the stripping rule.
 */
function writeInlineCode(value: string): string {
	let fence = "`".repeat(longestRun(value, "`") + 1);
	let pads =
		value.startsWith("`") ||
		value.endsWith("`") ||
		(value.startsWith(" ") && value.endsWith(" ") && value.trim() !== "");

	return `${fence}${pads ? ` ${value} ` : value}${fence}`;
}

/** A link, written as an autolink where the text already reads as the destination. */
function writeLink(node: Markdown.Link, context: InlineContext): string {
	let only = node.children.length === 1 ? node.children[0] : undefined;

	if (node.title === undefined && only?.type === "text" && only.value === node.href) {
		return `<${node.href}>`;
	}

	let text = stringifyInlines(node.children, context, false);
	return `[${text}](${writeDestination(node.href, node.title)})`;
}

/** A destination and its title, angle-wrapped where the bare form would break on a space. */
function writeDestination(destination: string, title?: string): string {
	let href =
		destination === "" || /[\s<>()]/.test(destination)
			? `<${destination.replace(/[<>\\]/g, (char) => `\\${char}`)}>`
			: destination;

	if (title === undefined) return href;

	return `${href} "${title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** An inline element, self-closing where it has nothing between its two halves. */
function writeTag(node: Markdown.Tag, context: InlineContext): string {
	let attributes = writeAttributes(node.attributes, false);
	let open = attributes === "" ? node.name : `${node.name} ${attributes}`;

	if (node.children.length === 0) return `<${open} />`;

	let children = stringifyInlines(node.children as Markdown.Inline[], context, false);
	return `<${open}>${children}</${node.name}>`;
}
