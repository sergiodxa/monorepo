/**
 * Documentation module for the public `/docs` site. Loads the bundled Markdown files
 * under `resources/docs/**` via `import.meta.glob`, validates their frontmatter with
 * `remix/data-schema`, and groups entries into ordered sections for the docs index
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
});

export type DocFrontmatter = s.InferOutput<typeof frontmatterSchema>;

/**
 * Hoisted so the index's frontmatter-only reads and the page's full parse agree on
 * the schema every doc file is held to.
 */
export const MARKDOWN_OPTIONS = { frontmatter: frontmatterSchema } satisfies Markdown.Options;

const docFileLoaders = import.meta.glob<string>("../../resources/docs/**/*.md", {
	query: "?raw",
	import: "default",
});

interface DocEntry {
	path: string;
	frontmatter: DocFrontmatter;
}

export interface DocSection {
	title: string;
	order: number;
	docs: DocEntry[];
}

/** Lists every doc, grouped into sections ordered by `frontmatter.section.order`. */
export async function listDocs(): Promise<DocSection[]> {
	let docs: DocEntry[] = [];

	for (let [filePath, loadContent] of Object.entries(docFileLoaders)) {
		let content = await loadContent();
		let result = Markdown.frontmatter(content, MARKDOWN_OPTIONS);
		if (!isSuccess(result)) continue;

		let urlPath = filePath.replace("../../resources/docs/", "/docs/").replace(/\.md$/, "");
		docs.push({ path: urlPath, frontmatter: result.data.frontmatter });
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

/** Resolves the raw-content loader for one doc slug (e.g. `concepts/monitors`). */
export function getDocLoader(slug: string) {
	let path = `../../resources/docs/${slug}.md`;
	let loader = docFileLoaders[path];
	if (!loader) return null;
	return { loader, path };
}

/** One neighbouring doc, reduced to what a pager link draws. */
export interface DocNeighbour {
	path: string;
	title: string;
}

/**
 * The docs read just before and just after `path`, in the order the sidebar lists them,
 * so the pager at a page's foot walks the same sequence a reader sees on the left. A path
 * outside the list, or at either end of it, gets `null` on that side.
 */
export function findNeighbours(
	sections: DocSection[],
	path: string,
): { previous: DocNeighbour | null; next: DocNeighbour | null } {
	let ordered = sections.flatMap((section) =>
		section.docs.map((doc) => ({ path: doc.path, title: doc.frontmatter.title })),
	);
	let index = ordered.findIndex((doc) => doc.path === path);
	if (index === -1) return { previous: null, next: null };
	return { previous: ordered[index - 1] ?? null, next: ordered[index + 1] ?? null };
}
