/**
 * Builds a tutorial as an EPUB, the format readers ask for to read one offline or annotate it.
 * The body is the same highlighted document the page renders, adapted to a file that leaves
 * the site: links point back at it, images become links, and sections get anchors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EpubError } from "@sdxc/epub";
import type { Result } from "@sdxc/result";

import { EPUB } from "@sdxc/epub";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { toPlainText } from "@sdxc/markdown/plain";
import { failure, success } from "@sdxc/result";

import epubCss from "~/resources/css/epub.css?raw";

/** What the EPUB of one tutorial is built from. */
export interface TutorialEpubInput {
	title: string;
	excerpt?: string;
	/** The technologies the tutorial uses, written as subjects and under the title. */
	tags: string[];
	/** The highlighted body, as the page renders it; `null` for a tutorial with no content. */
	document: Markdown.Document | null;
	/** The tutorial's permalink, which is also the book's identifier and every link's base. */
	url: string;
	/** When the tutorial was published, shown under the title. */
	published: Date | null;
	publishedLabel: string;
	/** When the tutorial last changed, so a reading app sees an edit as an update. */
	modified: Date;
}

/** The author every tutorial is credited to. */
const AUTHOR = { name: "Sergio Xalambrí", role: "aut", fileAs: "Xalambrí, Sergio" };

/**
 * Builds the EPUB for one tutorial. The permalink is the identifier, so downloading a
 * tutorial again replaces the copy in a reader's library instead of adding a second book.
 *
 * @param input - The tutorial's text, metadata and permalink.
 * @returns The publication, or the failure adapting or building it.
 * @example tutorialEpub({ title, tags, document, url, published, publishedLabel, modified })
 */
export function tutorialEpub(input: TutorialEpubInput): Result<EPUB, EpubError | Error> {
	let adapted = adaptDocument(input.document, input.url);
	if (adapted.status === "failure") return adapted;

	let { document, sections } = adapted.data;
	let body = [
		`<h1>${escape(input.title)}</h1>`,
		input.tags.length > 0 ? `<p class="used">Used: ${escape(input.tags.join(" · "))}</p>` : "",
		`<p class="byline">By ${escape(AUTHOR.name)}${input.publishedLabel ? ` · ${escape(input.publishedLabel)}` : ""} · <a href="${escape(input.url)}">Read it online</a></p>`,
		document ? toHTML(document, { syntax: "xhtml" }) : "<p>No content.</p>",
	].join("\n");

	return EPUB.build({
		metadata: {
			identifier: input.url,
			title: input.title,
			language: "en",
			modified: input.modified,
			...(input.published ? { published: input.published } : {}),
			creators: [AUTHOR],
			publisher: AUTHOR.name,
			...(input.excerpt ? { description: input.excerpt } : {}),
			rights: `© ${(input.published ?? input.modified).getUTCFullYear()} ${AUTHOR.name}`,
			subjects: input.tags,
			accessibility: {
				summary:
					"A text tutorial with structured headings, a table of contents and code samples; images are linked to the online version.",
				modes: ["textual"],
				modesSufficient: ["textual"],
				features: ["structuralNavigation", "tableOfContents"],
				hazards: ["none"],
			},
		},
		styles: [{ path: "styles/tutorial.css", text: epubCss }],
		chapters: [{ id: "tutorial", title: input.title, body, sections }],
	});
}

/**
 * Adapts the page's document to a file read away from the site: every link becomes an
 * absolute URL on the blog, every image a link to the image (an EPUB may embed only files it
 * carries; inside a link, its text), and every `##` and `###` an anchor the toc opens at.
 */
function adaptDocument(
	document: Markdown.Document | null,
	url: string,
): Result<{ document: Markdown.Document | null; sections: EPUB.Section[] }, Error> {
	let sections: EPUB.Section[] = [];
	if (!document) return success({ document, sections });

	let taken = new Set<string>();
	let walked = Markdown.walk(document, {
		link(node) {
			return { ...node, href: absolute(node.href, url) };
		},
		image(node, parent) {
			let alt = node.children
				.map((child) => toPlainText(child))
				.join("")
				.trim();
			let label = alt ? `Image: ${alt}` : "Image";
			if (parent?.type === "link") return { type: "text", value: label, position: node.position };
			return {
				type: "link",
				href: absolute(node.src, url),
				children: [{ type: "text", value: label, position: node.position }],
				position: node.position,
			};
		},
		heading(node) {
			if (node.level < 2 || node.level > 3) return;
			let title = toPlainText(node).trim();
			let id = typeof node.attributes.id === "string" ? node.attributes.id : slug(title, taken);
			taken.add(id);
			let parent = sections.at(-1);
			if (node.level === 3 && parent) (parent.sections ??= []).push({ title, fragment: id });
			else sections.push({ title, fragment: id });
			return { ...node, attributes: { ...node.attributes, id } };
		},
	});
	if (walked.status === "failure") {
		return failure(
			new Error("The tutorial could not be adapted for an EPUB", { cause: walked.error }),
		);
	}
	return success({ document: walked.data, sections });
}

/**
 * Resolves a link against the tutorial's permalink, so a site-relative path or a fragment
 * opens the blog; a reference that is no URL at all is left as written.
 */
function absolute(href: string, base: string): string {
	try {
		return new URL(href, base).href;
	} catch {
		return href;
	}
}

/** A heading's id: `section-` and its text in dashes, unique against the ids already given. */
function slug(title: string, taken: Set<string>): string {
	let base = `section-${title
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "")}`;
	let id = base;
	for (let suffix = 2; taken.has(id); suffix++) id = `${base}-${suffix}`;
	taken.add(id);
	return id;
}

/** Escapes text for the XHTML written around the rendered body. */
function escape(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}
