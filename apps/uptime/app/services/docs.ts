/**
 * Documentation module for the public `/docs` site. Loads the bundled Markdown files
 * under `resources/docs/**` via `import.meta.glob`, validates their frontmatter with
 * `remix/data-schema`, and groups entries into ordered sections for the docs index
 * and sidebar. Resolves a single slug's loader for the `/docs/*slug` page. These are
 * the real public docs content (getting started, concepts, API reference, team &
 * settings) — a distinct, publicly-served set from this repo's `docs/*.md`
 * engineering feature specs (`docs/README.md`), which describe product behavior for
 * reimplementers and are never surfaced to end users.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@pkg/markdown/server";
import { isSuccess } from "@pkg/result";
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

/** Shared parser for every doc file's frontmatter + Markdoc body. */
export const markdown = new Markdown({ frontmatter: frontmatterSchema });

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
		let result = Markdown.frontmatter<DocFrontmatter, typeof frontmatterSchema>(
			content,
			frontmatterSchema,
		);
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
