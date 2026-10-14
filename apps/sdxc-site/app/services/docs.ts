/**
 * The handwritten guides: every file under `resources/docs`, its frontmatter held to
 * one schema, and the ordered sections the shell's sidebar is drawn from. The files
 * are loaded lazily so a page pays for the one guide it renders rather than for the
 * whole tree, and the read happens inside a request because work in the worker's
 * global scope fails upload validation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";

import { TAGS } from "~/app/services/content";

/**
 * What every guide states about itself. `section` is written per file rather than
 * derived from the directory so a guide can be moved on disk without changing where
 * it reads in the sidebar.
 */
const frontmatterSchema = s.object({
	title: s.string(),
	description: s.string(),
	section: s.object({ title: s.string(), order: s.number() }),
	order: s.number(),
	lastUpdated: s.optional(s.string()),
});

export type GuideFrontmatter = s.InferOutput<typeof frontmatterSchema>;

/**
 * Hoisted so the sidebar's frontmatter-only read and a page's full parse agree. A
 * guide is written in the same vocabulary as the rest of the site's copy, so a tag a
 * landing section uses reads the same way inside a guide.
 */
export const MARKDOWN_OPTIONS = {
	frontmatter: frontmatterSchema,
	tags: TAGS,
} satisfies Markdown.Options;

/** Where the glob's keys start, and the prefix a slug is the remainder of. */
const DOCS_PREFIX = "../../resources/docs/";

const guideLoaders = import.meta.glob<string>("../../resources/docs/**/*.md", {
	query: "?raw",
	import: "default",
});

/** One guide, as the sidebar and the hub list it. */
export interface GuideEntry {
	/** The path under `/docs`, e.g. `conventions/naming`. */
	slug: string;
	frontmatter: GuideFrontmatter;
}

/** A titled run of guides, in the order they are meant to be read. */
export interface GuideSection {
	title: string;
	order: number;
	guides: GuideEntry[];
}

/**
 * Every guide, grouped into sections ordered by `section.order` and each section's
 * guides by their own `order`. A file whose frontmatter misses the schema is left
 * out rather than taking the listing down with it; the page for that slug reports
 * the failure with the line it sits on.
 */
export async function listGuides(): Promise<GuideSection[]> {
	let sections = new Map<string, GuideSection>();

	for (let [path, load] of Object.entries(guideLoaders)) {
		let parsed = Markdown.frontmatter(await load(), MARKDOWN_OPTIONS);
		if (!isSuccess(parsed)) continue;

		let { frontmatter } = parsed.data;
		let slug = path.slice(DOCS_PREFIX.length).replace(/\.md$/, "");

		let section = sections.get(frontmatter.section.title);
		if (!section) {
			section = { title: frontmatter.section.title, order: frontmatter.section.order, guides: [] };
			sections.set(frontmatter.section.title, section);
		}

		section.guides.push({ slug, frontmatter });
	}

	for (let section of sections.values()) {
		section.guides.sort((a, b) => a.frontmatter.order - b.frontmatter.order);
	}

	return Array.from(sections.values()).sort((a, b) => a.order - b.order);
}

/** The source of one guide, or `null` when no file answers to that slug. */
export async function readGuide(slug: string): Promise<string | null> {
	let load = guideLoaders[`${DOCS_PREFIX}${slug}.md`];
	if (!load) return null;
	return await load();
}
