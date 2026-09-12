/**
 * Writes blocks back as source, one normalized spelling per construct: ATX
 * headings, backtick fences, `-` bullets, padded tables. An annotation rides the
 * opening line where a block has one and takes the line above where it does not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../../index.js";

import { writeAnnotation, writeAttributes } from "./attributes.js";
import { longestRun } from "./escape.js";
import { stringifyInlines } from "./inline.js";

/** The types that belong to the inline category alone, which is what a tag's children are read by. */
const INLINE_TYPES = new Set([
	"text",
	"emphasis",
	"strong",
	"strikethrough",
	"inlineCode",
	"link",
	"image",
	"softBreak",
	"hardBreak",
	"inlineHtml",
	"footnoteReference",
	"variable",
]);

/** The narrowest a table column is drawn, which is the width its delimiter row needs. */
const MIN_COLUMN = 3;

/**
 * Writes a run of blocks, separated by the blank line that keeps them apart.
 *
 * @param nodes - The blocks to write
 * @param separator - What goes between two blocks, which a tight list narrows to one newline
 * @returns The block source
 * @example stringifyBlocks(document.children)
 */
export function stringifyBlocks(nodes: Markdown.Block[], separator = "\n\n"): string {
	let written: string[] = [];

	for (let node of nodes) {
		let text = stringifyBlock(node);
		if (text !== "") written.push(text);
	}

	return written.join(separator);
}

/** One block, annotation included, in the spelling the serializer has settled on. */
function stringifyBlock(node: Markdown.Block): string {
	switch (node.type) {
		case "heading":
			return writeHeading(node);
		case "paragraph":
			return above(node.attributes, stringifyInlines(node.children, { table: false }, true));
		case "code":
			return writeCode(node);
		case "list":
			return above(node.attributes, writeList(node));
		case "listItem":
			return above(node.attributes, writeListItem(node, "- ", "\n\n"));
		case "blockquote":
			return above(node.attributes, prefix(stringifyBlocks(node.children), "> "));
		case "alert":
			return writeAlert(node);
		case "table":
			return above(node.attributes, writeTable(node));
		case "tableRow":
			return above(node.attributes, writeStandaloneRow(node));
		case "tableCell":
			return above(node.attributes, stringifyInlines(node.children, { table: false }, true));
		case "thematicBreak":
			return above(node.attributes, "---");
		case "html":
			return above(node.attributes, node.value);
		case "footnoteDefinition":
			return writeFootnoteDefinition(node);
		case "tag":
			return writeTag(node);
	}
}

/** Places an annotation on the line above a block, which is where a multi-line opener takes one. */
function above(attributes: Markdown.Attributes, text: string): string {
	let annotation = writeAnnotation(attributes);
	return annotation === null ? text : `${annotation}\n${text}`;
}

/** A heading, whose single-line opener carries its annotation after the text. */
function writeHeading(node: Markdown.Heading): string {
	let text = stringifyInlines(node.children, { table: false }, false).replace(/\\?\n\s*/g, " ");
	let line = `${"#".repeat(node.level)} ${text}`.trimEnd();
	let annotation = writeAnnotation(node.attributes);

	return annotation === null ? line : `${line} ${annotation}`;
}

/**
 * A fenced code block, whose info string carries its annotation. Content holding a
 * fence-length backtick run switches the fence to tildes, so the block still closes
 * where it was meant to.
 */
function writeCode(node: Markdown.Code): string {
	let language = node.language ?? "";
	let annotation = writeAnnotation(node.attributes);
	let info = annotation === null ? language : `${language} ${annotation}`.trim();
	let backticks = longestRun(node.content, "`");
	let tildes = backticks >= MIN_COLUMN || info.includes("`");
	let marker = tildes ? "~" : "`";
	let width = tildes ? Math.max(3, longestRun(node.content, "~") + 1) : Math.max(3, backticks + 1);
	let fence = marker.repeat(width);
	let content = node.content.endsWith("\n") ? node.content.slice(0, -1) : node.content;

	if (content === "") return `${fence}${info}\n${fence}`;

	return `${fence}${info}\n${content}\n${fence}`;
}

/** A list, numbering from `start` and keeping its items as close together as `tight` says. */
function writeList(node: Markdown.List): string {
	let start = node.start ?? 1;
	let separator = node.tight ? "\n" : "\n\n";
	let items = node.children.map((item, index) => {
		let marker = node.ordered ? `${start + index}. ` : "- ";
		return writeListItem(item, marker, separator);
	});

	return items.join(separator);
}

/** One item, its continuation lines indented to sit under the text the marker opened. */
function writeListItem(node: Markdown.ListItem, marker: string, separator: string): string {
	let box = node.checked === undefined ? "" : node.checked ? "[x] " : "[ ] ";
	let body = `${box}${above(node.attributes, stringifyBlocks(node.children, separator))}`;
	let indent = " ".repeat(marker.length);

	return body
		.split("\n")
		.map((line, index) => {
			if (index === 0) return line === "" ? marker.trimEnd() : `${marker}${line}`;
			return line === "" ? "" : `${indent}${line}`;
		})
		.join("\n");
}

/** A GitHub alert, which is a block quote whose first line names its kind. */
function writeAlert(node: Markdown.Alert): string {
	let head = `[!${node.kind.toUpperCase()}]`;
	let body = stringifyBlocks(node.children);
	let quoted = prefix(body === "" ? head : `${head}\n${body}`, "> ");

	return above(node.attributes, quoted);
}

/** Puts a container's marker in front of every line, leaving a blank line unpadded. */
function prefix(text: string, marker: string): string {
	return text
		.split("\n")
		.map((line) => (line === "" ? marker.trimEnd() : `${marker}${line}`))
		.join("\n");
}

/** A table whose columns are padded to one width each, the way the repository formats one. */
function writeTable(node: Markdown.Table): string {
	let rows = node.children.map((row) =>
		row.children.map((cell) => stringifyInlines(cell.children, { table: true }, false)),
	);
	let columns = Math.max(node.align.length, ...rows.map((row) => row.length), 1);
	let widths: number[] = [];

	for (let column = 0; column < columns; column += 1) {
		let width = MIN_COLUMN;
		for (let row of rows) width = Math.max(width, (row[column] ?? "").length);
		widths.push(width);
	}

	let lines = [writeRow(rows[0] ?? [], widths), writeDelimiterRow(node.align, widths)];
	for (let row of rows.slice(1)) lines.push(writeRow(row, widths));

	return lines.join("\n");
}

/** A row written on its own, which is what a bare `tableRow` outside a table can become. */
function writeStandaloneRow(node: Markdown.TableRow): string {
	let cells = node.children.map((cell) => stringifyInlines(cell.children, { table: true }, false));
	return writeRow(
		cells,
		cells.map((cell) => Math.max(MIN_COLUMN, cell.length)),
	);
}

/** One row, every cell padded to its column's width and fenced on both sides. */
function writeRow(cells: string[], widths: number[]): string {
	let padded = widths.map((width, index) => (cells[index] ?? "").padEnd(width));
	return `| ${padded.join(" | ")} |`;
}

/** The delimiter row, whose colons are where a column's alignment is written down. */
function writeDelimiterRow(
	align: Array<"left" | "center" | "right" | null>,
	widths: number[],
): string {
	let cells = widths.map((width, index) => {
		switch (align[index] ?? null) {
			case "left":
				return `:${"-".repeat(width - 1)}`;
			case "right":
				return `${"-".repeat(width - 1)}:`;
			case "center":
				return `:${"-".repeat(width - 2)}:`;
			default:
				return "-".repeat(width);
		}
	});

	return `| ${cells.join(" | ")} |`;
}

/** A footnote body, whose continuation lines sit four spaces in so they stay with the label. */
function writeFootnoteDefinition(node: Markdown.FootnoteDefinition): string {
	let body = above(node.attributes, stringifyBlocks(node.children));
	let lines = body.split("\n");
	let first = `[^${node.identifier}]: ${lines[0] ?? ""}`.trimEnd();
	let rest = lines.slice(1).map((line) => (line === "" ? "" : `    ${line}`));

	return [first, ...rest].join("\n");
}

/** A block-level element, whose children are read as blocks unless the first one is inline. */
function writeTag(node: Markdown.Tag): string {
	let attributes = writeAttributes(node.attributes, false);
	let open = attributes === "" ? node.name : `${node.name} ${attributes}`;

	if (node.children.length === 0) return `<${open} />`;

	let first = node.children[0];
	let children =
		first !== undefined && INLINE_TYPES.has(first.type)
			? stringifyInlines(node.children as Markdown.Inline[], { table: false }, true)
			: stringifyBlocks(node.children as Markdown.Block[]);

	return `<${open}>\n${children}\n</${node.name}>`;
}
