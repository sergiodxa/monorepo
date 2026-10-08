/**
 * Writes a message's portable Markdown in each platform's own dialect, escaping literal
 * text for it, and fits the result under a platform limit by cutting the source text at
 * a grapheme boundary before escaping, so a cut never splits an entity or a tag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

/** What ends a cut text, so a reader sees that something was left out. */
const ELLIPSIS = "…";

/** Rounds of shrinking the text budget before falling back to plain truncation. */
const MAX_FIT_ROUNDS = 8;

/** Splits text into user-perceived characters, so a cut never halves an emoji or an accent. */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * How one platform writes formatted text. Every hook receives inner text that is
 * already written in the dialect, except `code` and `codeBlock`, which receive the
 * literal source and escape it themselves.
 */
export interface Dialect {
	/** Escapes literal text so the platform shows it as typed. */
	escape: (text: string) => string;
	strong: (inner: string) => string;
	emphasis: (inner: string) => string;
	strike: (inner: string) => string;
	code: (value: string) => string;
	codeBlock: (content: string, language: string | undefined) => string;
	/** `label` is already written; `href` is the raw URL. */
	link: (label: string, href: string) => string;
	/** Wraps already-written block text as a quote. */
	quote: (inner: string) => string;
}

/** Characters that only need escaping inside HTML text and attribute values. */
function escapeHtml(text: string): string {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Escapes a URL for a double-quoted HTML attribute. */
function escapeAttribute(text: string): string {
	return escapeHtml(text).replaceAll('"', "&quot;");
}

/** Prefixes every line with `> `, which every Markdown-like chat dialect reads as a quote. */
function quoteLines(inner: string, marker = "> "): string {
	return inner
		.split("\n")
		.map((line) => `${marker}${line}`)
		.join("\n");
}

/** A fenced code block, the form every Markdown-like chat dialect accepts. */
function fence(content: string, language: string | undefined): string {
	return `\`\`\`${language ?? ""}\n${content}\n\`\`\``;
}

/** Writes a link as its label and URL in words, for a dialect without links. */
function spelledLink(label: string, href: string): string {
	return label === "" || label === href ? href : `${label}: ${href}`;
}

/**
 * Slack's `mrkdwn`, which Google Chat's text format shares. Only `&`, `<` and `>` are
 * control characters, so emphasis markers in literal text are left as typed.
 */
export const mrkdwn: Dialect = {
	escape: escapeHtml,
	strong: (inner) => `*${inner}*`,
	emphasis: (inner) => `_${inner}_`,
	strike: (inner) => `~${inner}~`,
	code: (value) => `\`${escapeHtml(value)}\``,
	codeBlock: (content) => fence(escapeHtml(content), undefined),
	link: (label, href) => {
		let url = href.replaceAll("|", "%7C").replaceAll(">", "%3E");
		return label === "" || label === href ? `<${url}>` : `<${url}|${label}>`;
	},
	quote: (inner) => quoteLines(inner),
};

/** Backslash-escapes every character Discord's Markdown treats as syntax. */
function escapeDiscord(text: string): string {
	return text.replace(/[\\*_~`|>#[\]()-]/gu, (char) => `\\${char}`);
}

/** Discord's Markdown, as embeds and message content read it. */
export const discordMarkdown: Dialect = {
	escape: escapeDiscord,
	strong: (inner) => `**${inner}**`,
	emphasis: (inner) => `*${inner}*`,
	strike: (inner) => `~~${inner}~~`,
	code: (value) => `\`${value.replaceAll("`", "ˋ")}\``,
	codeBlock: (content, language) => fence(content.replaceAll("```", "ˋˋˋ"), language),
	link: (label, href) =>
		label === "" || label === href ? `<${href}>` : `[${label}](${href.replaceAll(")", "%29")})`,
	quote: (inner) => quoteLines(inner),
};

/** Backslash-escapes the characters an Adaptive Card text block reads as Markdown. */
function escapeTeams(text: string): string {
	return text.replace(/[\\*_[\]]/gu, (char) => `\\${char}`);
}

/**
 * The Markdown subset an Adaptive Card text block renders: bold, italic and links.
 * Strikethrough and code have no form there, so they are written as plain text.
 */
export const teamsMarkdown: Dialect = {
	escape: escapeTeams,
	strong: (inner) => `**${inner}**`,
	emphasis: (inner) => `_${inner}_`,
	strike: (inner) => inner,
	code: (value) => escapeTeams(value),
	codeBlock: (content) => escapeTeams(content),
	link: (label, href) =>
		label === "" ? `[${escapeTeams(href)}](${href})` : `[${label}](${href.replaceAll(")", "%29")})`,
	quote: (inner) => quoteLines(inner),
};

/**
 * Telegram's HTML `parse_mode`, which needs only `&`, `<` and `>` escaped, where
 * MarkdownV2 rejects a whole message over any of eighteen unescaped characters.
 */
export const telegramHtml: Dialect = {
	escape: escapeHtml,
	strong: (inner) => `<b>${inner}</b>`,
	emphasis: (inner) => `<i>${inner}</i>`,
	strike: (inner) => `<s>${inner}</s>`,
	code: (value) => `<code>${escapeHtml(value)}</code>`,
	codeBlock: (content, language) =>
		language === undefined
			? `<pre>${escapeHtml(content)}</pre>`
			: `<pre><code class="language-${escapeAttribute(language)}">${escapeHtml(content)}</code></pre>`,
	link: (label, href) =>
		`<a href="${escapeAttribute(href)}">${label === "" ? escapeHtml(href) : label}</a>`,
	quote: (inner) => `<blockquote>${inner}</blockquote>`,
};

/** WhatsApp's formatting, which has no escape and no links, so a link is spelled out. */
export const whatsappText: Dialect = {
	escape: (text) => text,
	strong: (inner) => `*${inner}*`,
	emphasis: (inner) => `_${inner}_`,
	strike: (inner) => `~${inner}~`,
	code: (value) => `\`${value}\``,
	codeBlock: (content) => fence(content, undefined),
	link: spelledLink,
	quote: (inner) => quoteLines(inner),
};

/** The HTML subset Pushover renders with `html=1`: bold, italic and links. */
export const pushoverHtml: Dialect = {
	escape: escapeHtml,
	strong: (inner) => `<b>${inner}</b>`,
	emphasis: (inner) => `<i>${inner}</i>`,
	strike: (inner) => inner,
	code: (value) => escapeHtml(value),
	codeBlock: (content) => escapeHtml(content),
	link: (label, href) =>
		`<a href="${escapeAttribute(href)}">${label === "" ? escapeHtml(href) : label}</a>`,
	quote: (inner) => quoteLines(inner, "&gt; "),
};

/** Text with every mark removed and links spelled out, for incident services and ntfy titles. */
export const plainText: Dialect = {
	escape: (text) => text,
	strong: (inner) => inner,
	emphasis: (inner) => inner,
	strike: (inner) => inner,
	code: (value) => value,
	codeBlock: (content) => content,
	link: spelledLink,
	quote: (inner) => quoteLines(inner),
};

/**
 * How many graphemes of literal text a write may still emit. Once spent, the text node
 * that crossed it ends in an ellipsis and every node after it is dropped.
 */
interface Budget {
	remaining: number;
	cut: boolean;
}

/** Takes up to the budget's remaining graphemes of `value`, marking the budget cut when short. */
function spend(value: string, budget: Budget): string {
	if (budget.cut) return "";

	let graphemes = Array.from(GRAPHEMES.segment(value), (segment) => segment.segment);
	if (graphemes.length <= budget.remaining) {
		budget.remaining -= graphemes.length;
		return value;
	}

	let kept = graphemes.slice(0, Math.max(budget.remaining, 0)).join("").trimEnd();
	budget.remaining = 0;
	budget.cut = true;
	return kept;
}

/** The trailing ellipsis a write appends once its budget cut the text. */
function ending(budget: Budget, dialect: Dialect): string {
	return budget.cut ? dialect.escape(ELLIPSIS) : "";
}

/** Counts graphemes, which is the unit a budget spends. */
function graphemeCount(value: string): number {
	return Array.from(GRAPHEMES.segment(value)).length;
}

/** Writes a run of inline nodes, stopping where the budget ran out. */
function writeInlines(nodes: Markdown.Inline[], dialect: Dialect, budget: Budget): string {
	let out = "";
	for (let node of nodes) {
		if (budget.cut) break;
		out += writeInline(node, dialect, budget);
	}
	return out;
}

/** Writes one inline node; a wrapper whose children were cut away entirely writes nothing. */
function writeInline(node: Markdown.Inline, dialect: Dialect, budget: Budget): string {
	switch (node.type) {
		case "text":
			return dialect.escape(spend(node.value, budget));
		case "inlineHtml":
			return dialect.escape(spend(node.value, budget));
		case "inlineCode": {
			let value = spend(node.value, budget);
			return value === "" ? "" : dialect.code(value);
		}
		case "strong":
		case "emphasis":
		case "strikethrough": {
			let inner = writeInlines(node.children, dialect, budget);
			if (inner === "") return "";
			if (node.type === "strong") return dialect.strong(inner);
			if (node.type === "emphasis") return dialect.emphasis(inner);
			return dialect.strike(inner);
		}
		case "link": {
			let label = writeInlines(node.children, dialect, budget);
			return label === "" && budget.cut ? "" : dialect.link(label, node.href);
		}
		case "image":
			return writeInlines(node.children, dialect, budget);
		case "softBreak":
		case "hardBreak":
			return "\n";
		case "tag":
		case "element":
			return writeChildren(node.children, dialect, budget);
		case "footnoteReference":
		case "variable":
		case "comment":
			return "";
	}
}

/** Writes a tag's children, which the parser hands over as either blocks or inlines. */
function writeChildren(
	children: Markdown.Block[] | Markdown.Inline[],
	dialect: Dialect,
	budget: Budget,
): string {
	if (children.length === 0) return "";
	if (children.some(isBlock)) return writeBlocks(children as Markdown.Block[], dialect, budget);
	return writeInlines(children as Markdown.Inline[], dialect, budget);
}

/**
 * Whether a node only ever stands as a block. A tag, an element and a comment stand
 * in either column, so a run of children is blocks once any one of them says so.
 */
function isBlock(node: Markdown.Block | Markdown.Inline): boolean {
	return !["tag", "element", "comment"].includes(node.type) && !isInline(node);
}

/** Whether a node belongs inside a sentence. */
function isInline(node: Markdown.Block | Markdown.Inline): node is Markdown.Inline {
	return [
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
	].includes(node.type);
}

/** Writes blocks separated by a blank line, dropping any block the budget left empty. */
function writeBlocks(nodes: Markdown.Block[], dialect: Dialect, budget: Budget): string {
	let parts: string[] = [];
	for (let node of nodes) {
		if (budget.cut) break;
		let written = writeBlock(node, dialect, budget);
		if (written !== "") parts.push(written);
	}
	return parts.join("\n\n");
}

/** Writes one block in the dialect; a heading becomes a bold line and a table its rows. */
function writeBlock(node: Markdown.Block, dialect: Dialect, budget: Budget): string {
	switch (node.type) {
		case "paragraph":
			return writeInlines(node.children, dialect, budget);
		case "heading": {
			let inner = writeInlines(node.children, dialect, budget);
			return inner === "" ? "" : dialect.strong(inner);
		}
		case "code": {
			let content = spend(node.content.replace(/\n$/u, ""), budget);
			return content === "" ? "" : dialect.codeBlock(content, node.language);
		}
		case "list":
			return writeList(node, dialect, budget);
		case "listItem":
			return writeBlocks(node.children, dialect, budget);
		case "blockquote":
		case "alert": {
			let inner = writeBlocks(node.children, dialect, budget);
			return inner === "" ? "" : dialect.quote(inner);
		}
		case "table":
			return node.children
				.map((row) => writeBlock(row, dialect, budget))
				.filter((line) => line !== "")
				.join("\n");
		case "tableRow":
			return node.children
				.map((cell) => writeInlines(cell.children, dialect, budget))
				.filter((cell) => cell !== "")
				.join(dialect.escape(" | "));
		case "tableCell":
			return writeInlines(node.children, dialect, budget);
		case "thematicBreak":
			return dialect.escape("———");
		case "html":
			return dialect.escape(spend(node.value.replace(/\n$/u, ""), budget));
		case "footnoteDefinition":
		case "comment":
			return "";
		case "tag":
		case "element":
			return writeChildren(node.children, dialect, budget);
	}
}

/** Writes a list one item per line, numbering an ordered one and indenting nested lines. */
function writeList(node: Markdown.List, dialect: Dialect, budget: Budget): string {
	let lines: string[] = [];
	let number = node.start ?? 1;
	for (let item of node.children) {
		if (budget.cut) break;
		let body = item.children
			.map((child) => writeBlock(child, dialect, budget))
			.filter((part) => part !== "")
			.join("\n");
		if (body === "") continue;

		let box = item.checked === undefined ? "" : item.checked ? "☑ " : "☐ ";
		let marker = node.ordered ? `${number}. ` : "• ";
		number += 1;
		let indent = " ".repeat(marker.length);
		let [first = "", ...rest] = body.split("\n");
		lines.push([`${marker}${box}${first}`, ...rest.map((line) => `${indent}${line}`)].join("\n"));
	}
	return lines.join("\n");
}

/** Writes a parsed document under a budget, appending the ellipsis when it cut. */
function writeDocument(document: Markdown.Document, dialect: Dialect, limit: number): string {
	let budget: Budget = { remaining: limit, cut: false };
	let written = writeBlocks(document.children, dialect, budget);
	return written + ending(budget, dialect);
}

/**
 * Writes portable Markdown in a platform's dialect. With a `maxLength`, the source is
 * cut short enough that the written form fits, ellipsis included; source that fails to
 * parse is written as escaped literal text.
 *
 * @param source - The message's portable Markdown.
 * @param dialect - The platform's dialect.
 * @param maxLength - The most UTF-16 code units the platform accepts.
 * @returns The written text.
 * @example writeText("**down** for `30s`", telegramHtml); // "<b>down</b> for <code>30s</code>"
 */
export function writeText(source: string, dialect: Dialect, maxLength = Infinity): string {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) return fitText(source, maxLength, dialect.escape);

	let document = parsed.data.document;
	let written = writeDocument(document, dialect, Infinity);
	if (written.length <= maxLength) return written;

	let budget = graphemeCount(source);
	for (let round = 0; round < MAX_FIT_ROUNDS; round += 1) {
		budget = Math.max(0, budget - (written.length - maxLength) - ELLIPSIS.length);
		written = writeDocument(document, dialect, budget);
		if (written.length <= maxLength) return written;
	}

	return fitText(writeDocument(document, plainText, Infinity), maxLength, dialect.escape);
}

/**
 * Fits literal text under a limit, cutting at a grapheme boundary before escaping, so
 * the cut never splits an entity, and ending a cut text in an ellipsis.
 *
 * @param value - Literal text, such as a title or a field value.
 * @param maxLength - The most UTF-16 code units the escaped text may take.
 * @param escape - The dialect's escape.
 * @returns The escaped text, at most `maxLength` long.
 * @example fitText("a <b> c", 6, telegramHtml.escape); // "a…"
 */
export function fitText(
	value: string,
	maxLength: number,
	escape: (text: string) => string = (text) => text,
): string {
	let escaped = escape(value);
	if (escaped.length <= maxLength) return escaped;

	let graphemes = Array.from(GRAPHEMES.segment(value), (segment) => segment.segment);
	let cut = (keep: number) => escape(graphemes.slice(0, keep).join("").trimEnd() + ELLIPSIS);
	let low = 0;
	let high = Math.min(graphemes.length, maxLength);
	while (low < high) {
		let middle = Math.ceil((low + high) / 2);
		if (cut(middle).length <= maxLength) low = middle;
		else high = middle - 1;
	}

	let fitted = cut(low);
	return fitted.length <= maxLength ? fitted : "";
}
