/**
 * Documentation module for the public `/docs` site. Loads the bundled Markdown files
 * under `resources/docs/**` via `import.meta.glob`, validates their frontmatter with
 * `remix/data-schema`, and groups entries into ordered sections for the sidebar and hub.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocsTree } from "@sdxc/ui/utils";

import { Markdown } from "@sdxc/markdown";
import { isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";

const frontmatterSchema = s.object({
	title: s.string(),
	description: s.string(),
	section: s.object({
		title: s.string(),
		order: s.number(),
	}),
	order: s.number(),
	lastUpdated: s.optional(s.string()),
	/** One fixed sentence under the title naming who or what a page's task needs. */
	notice: s.optional(s.string()),
	/** Doc paths the page hands the reader on to, in the order a reader takes them. */
	next: s.optional(s.array(s.string())),
	/** Words a reader may search with that the page never uses ("check" for a monitor). */
	keywords: s.optional(s.array(s.string())),
});

export type DocFrontmatter = s.InferOutput<typeof frontmatterSchema>;

/**
 * The tags a doc may write beyond Markdown: a numbered procedure, the product's own
 * controls as chips, keys, an inline product mockup, a list of questions, and the API
 * reference's operation placeholder. Each `step` carries its own `id` for the rail.
 */
const DOC_TAGS = {
	steps: {},
	step: { attributes: s.object({ id: s.string(), title: s.string() }) },
	ui: { content: "inline" },
	uipath: { content: "none", attributes: s.object({ items: s.array(s.string()) }) },
	kbd: { content: "inline" },
	mockup: {
		content: "none",
		attributes: s.object({ area: s.string(), caption: s.optional(s.string()) }),
	},
	faq: {},
	question: { attributes: s.object({ title: s.string() }) },
	operation: { content: "none", attributes: s.object({ name: s.string() }) },
} satisfies Markdown.Options["tags"];

/**
 * Hoisted so the index's frontmatter-only reads, the page's full parse and the search
 * index agree on the schema and the tags every doc file is held to.
 */
export const MARKDOWN_OPTIONS = {
	frontmatter: frontmatterSchema,
	tags: DOC_TAGS,
} satisfies Markdown.Options;

const docFileLoaders = import.meta.glob<string>("../../resources/docs/**/*.md", {
	query: "?raw",
	import: "default",
});

/** One doc as the sidebar, hub and search list it. */
export interface DocEntry {
	path: string;
	frontmatter: DocFrontmatter;
}

export interface DocSection {
	title: string;
	order: number;
	docs: DocEntry[];
}

/** What a reader does with a page, which search labels each result with. */
export type DocKind = "guide" | "troubleshooting" | "concept" | "reference";

/** Lists every doc, grouped into sections ordered by `frontmatter.section.order`. */
export async function listDocs(): Promise<DocSection[]> {
	let docs: DocEntry[] = [];

	for (let [filePath, loadContent] of Object.entries(docFileLoaders)) {
		let content = await loadContent();
		let result = Markdown.frontmatter(content, MARKDOWN_OPTIONS);
		if (!isSuccess(result)) continue;

		docs.push({ path: docPath(filePath), frontmatter: result.data.frontmatter });
	}

	let sections = new Map<string, DocSection>();
	for (let doc of docs) {
		let sectionTitle = doc.frontmatter.section.title;
		let section = sections.get(sectionTitle);
		if (!section) {
			section = { title: sectionTitle, order: doc.frontmatter.section.order, docs: [] };
			sections.set(sectionTitle, section);
		}
		section.docs.push(doc);
	}

	for (let section of sections.values()) {
		section.docs.sort((a, b) => a.frontmatter.order - b.frontmatter.order);
	}

	return Array.from(sections.values()).sort((a, b) => a.order - b.order);
}

/** Every doc's raw source beside its path, for the search index. */
export async function loadDocSources(): Promise<Array<{ path: string; source: string }>> {
	return Promise.all(
		Object.entries(docFileLoaders).map(async ([filePath, loadContent]) => ({
			path: docPath(filePath),
			source: await loadContent(),
		})),
	);
}

/** The URL a bundled doc file is served at. */
function docPath(filePath: string): string {
	return filePath.replace("../../resources/docs/", "/docs/").replace(/\.md$/, "");
}

/** Resolves the raw-content loader for one doc slug (e.g. `concepts/monitors`). */
export function getDocLoader(slug: string) {
	let path = `../../resources/docs/${slug}.md`;
	let loader = docFileLoaders[path];
	if (!loader) return null;
	return { loader, path };
}

/**
 * The kind of page a path holds, read from the folder it lives in, so a new doc is
 * labelled by where it is filed.
 */
export function docKind(path: string): DocKind {
	if (path.startsWith("/docs/troubleshooting/")) return "troubleshooting";
	if (path.startsWith("/docs/concepts/")) return "concept";
	if (path.startsWith("/docs/api/")) return "reference";
	return "guide";
}

/** The sections as the shared sidebar and pager read them, in sidebar order. */
export function toDocsTree(sections: DocSection[], label: string): DocsTree {
	return {
		label,
		sections: sections.map((section) => ({
			title: section.title,
			items: section.docs.map((doc) => ({ title: doc.frontmatter.title, href: doc.path })),
		})),
	};
}

/** Finds one doc by its path across every section, or `null` for a path no doc serves. */
export function findDoc(sections: DocSection[], path: string): DocEntry | null {
	for (let section of sections) {
		let doc = section.docs.find((entry) => entry.path === path);
		if (doc) return doc;
	}
	return null;
}
