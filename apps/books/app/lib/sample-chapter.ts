/**
 * The sample chapter, read from the bundled Markdown once per isolate, in both forms the
 * funnel hands out: the painted document the unlocked page renders, and the EPUB the signed
 * download link serves. The first request that needs either does the work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EpubError } from "@sdxc/epub";
import type { Result } from "@sdxc/result";

import { Base64 } from "@sdxc/crypto";
import { EPUB } from "@sdxc/epub";
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { toPlainText } from "@sdxc/markdown/plain";
import { failure, isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

import chapterSource from "~/resources/content/sample.md?raw";
import epubCss from "~/resources/css/epub.css?raw";
import coverDataUrl from "~/resources/images/epub-cover.jpg?inline";

/** Logged beside a failure's line so a malformed chapter names the file to open. */
export const CHAPTER_FILE = "resources/content/sample.md";

/** The chapter opens straight into prose, so the block it may carry is an empty one. */
const MARKDOWN_OPTIONS = { frontmatter: s.object({}) } satisfies Markdown.Options;

/**
 * What a reading system recognises the sample by. It stays fixed for the life of the
 * sample, so a reader who downloads it twice has one book in their library, not two.
 */
const SAMPLE_IDENTIFIER = "urn:uuid:3f6c9a52-8d1e-4b7a-9c3f-5e2d8a1b7c40";

/** When the chapter last changed; move it with every edit to `sample.md`, so readers see an update. */
const SAMPLE_MODIFIED = "2026-10-08T00:00:00Z";

/** A failure reading the chapter, in either of the forms the funnel serves. */
export type ChapterError = Markdown.ParseError | Markdown.WalkError | EpubError | Error;

/** The chapter, parsed and painted, once per isolate; the Workers global scope holds imports only. */
let chapter: Result<Markdown.Document, Markdown.ParseError | Markdown.WalkError> | undefined;

/** The EPUB built from {@link chapter}, once per isolate. */
let epub: Result<EPUB, ChapterError> | undefined;

/**
 * Reads and paints the chapter, or hands back the work already done in this isolate.
 *
 * @returns The painted document, or the failure that stopped it.
 */
export function readChapter(): Result<Markdown.Document, Markdown.ParseError | Markdown.WalkError> {
	if (chapter) return chapter;

	let parsed = Markdown.parse(chapterSource, MARKDOWN_OPTIONS);
	if (isFailure(parsed)) {
		chapter = parsed;
		return chapter;
	}

	chapter = Markdown.walk(parsed.data.document, highlight);
	return chapter;
}

/**
 * Builds the sample as an EPUB, or hands back the one already built in this isolate. Its
 * headings get ids so the table of contents opens at each section, and the cover is the
 * bundled into the Worker as a data URL.
 *
 * @returns The publication, or the failure in the chapter, the cover or the build.
 */
export function readSampleEpub(): Result<EPUB, ChapterError> {
	if (epub) return epub;

	let document = readChapter();
	if (isFailure(document)) {
		epub = document;
		return epub;
	}

	let cover = Base64.decode(coverDataUrl.slice(coverDataUrl.indexOf(",") + 1));
	if (isFailure(cover)) {
		epub = failure(
			new Error("The bundled cover image is not valid base64", { cause: cover.error }),
		);
		return epub;
	}

	let { document: anchored, sections } = anchorHeadings(document.data);
	epub = EPUB.build({
		metadata: {
			identifier: SAMPLE_IDENTIFIER,
			title: "React Router OAuth2 Handbook: OAuth2 in Simple Terms",
			language: "en",
			modified: new Date(SAMPLE_MODIFIED),
			creators: [{ name: "Sergio Xalambrí", role: "aut", fileAs: "Xalambrí, Sergio" }],
			publisher: "Sergio Xalambrí",
			description:
				"A free sample chapter of the React Router OAuth2 Handbook: the ideas behind OAuth2, its actors, scopes, endpoints and flows.",
			rights: "© 2026 Sergio Xalambrí",
			accessibility: {
				summary:
					"A text chapter with structured headings, a table of contents and code samples; the cover image has a text alternative.",
				modes: ["textual", "visual"],
				modesSufficient: ["textual"],
				features: ["structuralNavigation", "tableOfContents", "alternativeText"],
				hazards: ["none"],
			},
		},
		cover: {
			image: { path: "images/cover.jpg", bytes: cover.data },
			alt: "React Router OAuth2 Handbook, books.sergiodxa.com",
		},
		styles: [{ path: "styles/book.css", text: epubCss }],
		chapters: [
			{
				id: "oauth2-simple-terms",
				title: "OAuth2 in Simple Terms",
				body: toHTML(anchored, { syntax: "xhtml" }),
				sections,
			},
		],
	});
	return epub;
}

/**
 * Gives every second- and third-level heading an id slugged from its text, and nests the
 * table of contents the same way: each `###` under the `##` before it.
 */
function anchorHeadings(document: Markdown.Document): {
	document: Markdown.Document;
	sections: EPUB.Section[];
} {
	let sections: EPUB.Section[] = [];
	let taken = new Set<string>();
	let children = document.children.map((node) => {
		if (node.type !== "heading" || node.level < 2 || node.level > 3) return node;
		let title = toPlainText(node).trim();
		let fragment =
			typeof node.attributes.id === "string" ? node.attributes.id : uniqueSlug(title, taken);
		let parent = sections.at(-1);
		if (node.level === 3 && parent) (parent.sections ??= []).push({ title, fragment });
		else sections.push({ title, fragment });
		return { ...node, attributes: { ...node.attributes, id: fragment } };
	});
	return { document: { ...document, children }, sections };
}

/** A lowercase, dash-separated id from a heading, made unique against the ids already given. */
function uniqueSlug(title: string, taken: Set<string>): string {
	let base = `section-${title
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "")}`;
	let slug = base;
	for (let suffix = 2; taken.has(slug); suffix++) slug = `${base}-${suffix}`;
	taken.add(slug);
	return slug;
}
