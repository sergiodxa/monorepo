/**
 * Documentation module that loads the bundled Markdown docs via import.meta.glob,
 * validates their frontmatter with a Zod schema, and groups the entries into
 * ordered sections for rendering. It also resolves per-slug, locale-aware doc
 * loaders. It exists to back the app's docs site from local Markdown files.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@pkg/markdown/server";
import { isSuccess } from "@pkg/result";
import { z } from "zod";

export let frontmatterSchema = z.object({
	title: z.string(),
	description: z.string(),
	section: z.object({
		title: z.string(),
		order: z.coerce.number(),
	}),
	order: z.coerce.number(),
	lastUpdated: z.string().optional(),
});

export type DocFrontmatter = z.infer<typeof frontmatterSchema>;

export let markdown = new Markdown({ frontmatter: frontmatterSchema });

export let docFileLoaders = import.meta.glob<string>("../../docs/**/*.md", {
	query: "?raw",
	import: "default",
});

type DocEntry = { path: string; frontmatter: DocFrontmatter };
export type DocSection = { title: string; order: number; docs: DocEntry[] };

export async function listDocs(): Promise<DocSection[]> {
	let docs: DocEntry[] = [];

	for (let [filePath, loadContent] of Object.entries(docFileLoaders)) {
		if (/\.\w{2}\.md$/.test(filePath)) continue;

		let content = await loadContent();
		let result = Markdown.frontmatter(content, frontmatterSchema);
		if (isSuccess(result)) {
			let urlPath = filePath.replace("../../docs/", "/docs/").replace(/\.md$/, "");
			docs.push({ path: urlPath, frontmatter: result.data.frontmatter });
		}
	}

	let sections = new Map<string, DocSection>();
	for (let doc of docs) {
		let sectionTitle = doc.frontmatter.section.title;
		if (!sections.has(sectionTitle)) {
			sections.set(sectionTitle, {
				title: sectionTitle,
				order: doc.frontmatter.section.order,
				docs: [],
			});
		}
		sections.get(sectionTitle)!.docs.push(doc);
	}

	for (let section of sections.values()) {
		section.docs.sort((a, b) => a.frontmatter.order - b.frontmatter.order);
	}

	return Array.from(sections.values()).sort((a, b) => a.order - b.order);
}

export function getDocLoader(slug: string, currentLocale: string) {
	let pathsToTry = [`../../docs/${slug}.${currentLocale}.md`, `../../docs/${slug}.md`];

	for (let path of pathsToTry) {
		let loader = docFileLoaders[path];
		if (loader) return { loader, path };
	}

	return null;
}
