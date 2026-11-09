/**
 * The shape of a Markdown book: the `#` heading is the book's title, every `##` heading opens
 * a chapter, and what stands between them is an opening page. Chapter files may hold only
 * chapters, so a stray paragraph or a second title is an error naming the file it is in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "@sdxc/markdown";
import type { Result } from "@sdxc/result";

import { toPlainText } from "@sdxc/markdown/plain";
import { failure, success } from "@sdxc/result";

import { EpubContentError } from "./errors.js";

/** The ids the generated pages take, which no chapter may. */
export const TITLE_PAGE_ID = "title-page";

/** The id of the page holding what an entry file writes between its title and first chapter. */
export const OPENING_ID = "opening";

/** One parsed Markdown file of the book, with every heading already given an id. */
export interface SourceDocument {
	/** The source path, relative to the book's folder. */
	path: string;
	/** Whether this is the file that may hold the title and the opening page. */
	entry: boolean;
	blocks: Markdown.Block[];
}

/** A chapter: its `##` heading and every block up to the next one. */
export interface SourceChapter {
	id: string;
	/** The source file it was written in, which its references resolve from. */
	file: string;
	heading: Markdown.Heading;
	blocks: Markdown.Block[];
}

/** The book's parts in reading order. */
export interface BookStructure {
	/** The `#` heading, when a file wrote one. */
	title: Markdown.Heading | undefined;
	/** What the entry file writes between its title and its first chapter. */
	opening: { file: string; blocks: Markdown.Block[] } | undefined;
	chapters: SourceChapter[];
}

/**
 * Splits the book's files into its title, opening page and chapters. Footnote definitions go
 * with the chapter that cites them, wherever in the file they were written.
 *
 * @param documents - The entry file, when there is one, then each chapter file in order
 * @returns The structure, or the content failure naming the file that breaks a rule
 */
export function splitBook(
	documents: readonly SourceDocument[],
): Result<BookStructure, EpubContentError> {
	let title: Markdown.Heading | undefined;
	let opening: BookStructure["opening"];
	let chapters: Omit<SourceChapter, "id">[] = [];

	for (let document of documents) {
		let leading: Markdown.Block[] = [];
		let current: Omit<SourceChapter, "id"> | undefined;
		let footnotes = new Map<string, Markdown.FootnoteDefinition>();
		let fileChapters: Omit<SourceChapter, "id">[] = [];

		for (let block of document.blocks) {
			if (block.type === "heading" && block.level === 1) {
				if (!document.entry) {
					return failure(
						new EpubContentError(
							`"${document.path}" has a "#" title; only the book's main file may, and chapter files start at "##"`,
							document.path,
						),
					);
				}
				if (title) {
					return failure(
						new EpubContentError(
							`"${document.path}" has a second "#" title; a book has one, and chapters start at "##"`,
							document.path,
						),
					);
				}
				title = block;
				continue;
			}
			if (block.type === "footnoteDefinition") {
				footnotes.set(block.identifier, block);
				continue;
			}
			if (block.type === "heading" && block.level === 2) {
				current = { file: document.path, heading: block, blocks: [block] };
				fileChapters.push(current);
				continue;
			}
			if (current) current.blocks.push(block);
			else if (block.type !== "comment") leading.push(block);
		}

		if (!document.entry && (leading.length > 0 || fileChapters.length === 0)) {
			return failure(
				new EpubContentError(
					leading.length > 0
						? `"${document.path}" has text before its first "##" chapter heading`
						: `"${document.path}" has no "##" chapter heading`,
					document.path,
				),
			);
		}
		for (let chapter of fileChapters)
			chapter.blocks.push(...citedFootnotes(chapter.blocks, footnotes));
		if (document.entry && leading.length > 0) {
			opening = {
				file: document.path,
				blocks: [...leading, ...citedFootnotes(leading, footnotes)],
			};
		}
		chapters.push(...fileChapters);
	}

	return success({ title, opening, chapters: assignIds(chapters) });
}

/** The footnote definitions the blocks cite, in the order they are first cited. */
function citedFootnotes(
	blocks: readonly Markdown.Block[],
	footnotes: ReadonlyMap<string, Markdown.FootnoteDefinition>,
): Markdown.FootnoteDefinition[] {
	let cited: Markdown.FootnoteDefinition[] = [];
	let seen = new Set<string>();
	visit(blocks, (node) => {
		if (node.type !== "footnoteReference" || seen.has(node.identifier)) return;
		seen.add(node.identifier);
		let definition = footnotes.get(node.identifier);
		if (definition) cited.push(definition);
	});
	return cited;
}

/**
 * Gives each chapter the file name it is written at: the heading's own id when it is one
 * EPUB accepts, otherwise an ASCII slug of its text, numbered past ids already taken.
 */
function assignIds(chapters: readonly Omit<SourceChapter, "id">[]): SourceChapter[] {
	let taken = new Set([TITLE_PAGE_ID, OPENING_ID]);
	return chapters.map((chapter, index) => {
		let own = chapter.heading.attributes.id;
		let base = preferredId(
			typeof own === "string" ? own : undefined,
			toPlainText(chapter.heading),
			index,
		);
		let id = base;
		for (let suffix = 2; taken.has(id.toLowerCase()); suffix++) id = `${base}-${suffix}`;
		taken.add(id.toLowerCase());
		return { ...chapter, id };
	});
}

/** The id a chapter would like before collisions are numbered away. */
function preferredId(own: string | undefined, text: string, index: number): string {
	if (own !== undefined && /^[A-Za-z_][A-Za-z0-9._-]*$/u.test(own)) return own;
	let slug = asciiSlug(text);
	if (slug === "") return `chapter-${index + 1}`;
	return /^[a-z_]/u.test(slug) ? slug : `chapter-${slug}`;
}

/**
 * Text as a lowercase ASCII slug of letters, digits and single hyphens, with accents
 * dropped, so it can name a file inside the container.
 */
export function asciiSlug(text: string): string {
	return text
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-+|-+$/gu, "");
}

/** Every node under the given ones, depth first, in document order. */
export function visit(
	nodes: readonly Markdown.Node[],
	callback: (node: Markdown.Node) => void,
): void {
	for (let node of nodes) {
		callback(node);
		if ("children" in node && Array.isArray(node.children)) {
			visit(node.children as Markdown.Node[], callback);
		}
	}
}

/** Every `id` an author or the headings pass wrote on a node under the given ones. */
export function idsIn(nodes: readonly Markdown.Node[]): string[] {
	let ids: string[] = [];
	visit(nodes, (node) => {
		if ("attributes" in node && typeof node.attributes.id === "string")
			ids.push(node.attributes.id);
	});
	return ids;
}
