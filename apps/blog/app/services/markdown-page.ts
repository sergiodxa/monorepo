/**
 * Parses a standalone page written as a Markdown file with a `title`/`description`
 * frontmatter, producing both what the HTML view renders and what the page serves when a
 * reader asks for its Markdown, so the two formats always say the same thing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

/** The page's own metadata, carried in each file's frontmatter. */
const frontmatterSchema = s.object({ title: s.string(), description: s.string() });

/** Metadata every Markdown page declares. */
export type MarkdownPageFrontmatter = s.InferOutput<typeof frontmatterSchema>;

/** A Markdown page, parsed. */
export interface MarkdownPage {
	frontmatter: MarkdownPageFrontmatter;
	/** The body alone, written back from the document, for serving as Markdown. */
	body: string;
	/** The body as a highlighted document, for the HTML view. */
	document: Markdown.Document;
}

/**
 * Parses one page's source. The Markdown a reader asks for is written back from the
 * document rather than sliced out of the file, so an agent reading the body reads exactly
 * what the page rendered. Called per request, keeping a bad file's failure on its own route.
 *
 * @param raw The file's contents, frontmatter included.
 * @returns The parsed page, or the error when the source will not parse.
 * @example
 * let page = parseMarkdownPage(source);
 */
export function parseMarkdownPage(raw: string): Result<MarkdownPage, Error> {
	let parsed = Markdown.parse(raw, { frontmatter: frontmatterSchema });
	if (isFailure(parsed)) return parsed;

	let body = Markdown.stringify(parsed.data.document);
	if (isFailure(body)) return body;

	let highlighted = Markdown.walk(parsed.data.document, highlight);
	if (isFailure(highlighted)) return highlighted;

	return success({
		frontmatter: parsed.data.frontmatter,
		body: body.data,
		document: highlighted.data,
	});
}
