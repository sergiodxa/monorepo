/**
 * Every help page Reader publishes, in the order a new reader meets them: its section, the
 * plan it needs, and where it hands the reader next. Titles and descriptions live in the
 * locale files and each page's body in one module per language under `pages/<locale>/`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { TableOfContents } from "@sdxc/ui";
import type { DocsTree } from "@sdxc/ui/utils";
import type { Handle, RemixNode } from "remix/component";

import type { DocBody } from "~/resources/docs/blocks";

import routes from "~/routes/web";

/** The sidebar's groups, in the order a reader's first week runs through them. */
export const DOC_SECTIONS = ["start", "read", "keep", "find", "reach", "account", "fix"] as const;

export type DocSectionKey = (typeof DOC_SECTIONS)[number];

/** What a page's module provides: its headings for the rail, and the body that draws them. */
export interface DocModule {
	TOC: TableOfContents.Item[];
	default: (handle: Handle<DocBody.Props>) => () => RemixNode;
}

export interface DocPage {
	slug: string;
	section: DocSectionKey;
	/** The lowest plan the page's feature needs; absent when every plan has it. */
	plan?: "paid" | "premium";
	/** Hand-picked pages that follow from this task, drawn as "Up next". */
	next: string[];
}

/** Every page body, keyed `./pages/<locale>/<slug>.tsx`, loaded only when a page is read. */
const BODIES = import.meta.glob<DocModule>("./pages/*/*.tsx");

/** The language every page is written in first, which any other falls back to. */
const SOURCE_LOCALE = "en";

export const DOC_PAGES: DocPage[] = [
	{
		slug: "getting-started",
		section: "start",
		next: ["import-opml", "reading", "keyboard-shortcuts"],
	},
	{
		slug: "import-opml",
		section: "start",
		next: ["folders", "reading"],
	},
	{
		slug: "reading",
		section: "read",
		next: ["keyboard-shortcuts", "saving", "feeds"],
	},
	{
		slug: "feeds",
		section: "read",
		next: ["pins", "folders", "feed-not-updating"],
	},
	{
		slug: "keyboard-shortcuts",
		section: "read",
		next: ["search", "saving"],
	},
	{
		slug: "saving",
		section: "keep",
		next: ["labels", "export"],
	},
	{
		slug: "labels",
		section: "keep",
		plan: "paid",
		next: ["search", "export"],
	},
	{
		slug: "pins",
		section: "keep",
		next: ["folders", "notifications"],
	},
	{
		slug: "folders",
		section: "keep",
		plan: "paid",
		next: ["filters", "import-opml"],
	},
	{
		slug: "filters",
		section: "keep",
		plan: "paid",
		next: ["notifications", "search"],
	},
	{
		slug: "search",
		section: "find",
		next: ["search-missing-post", "labels"],
	},
	{
		slug: "notifications",
		section: "reach",
		plan: "paid",
		next: ["pins", "filters"],
	},
	{
		slug: "agents",
		section: "reach",
		plan: "paid",
		next: ["search", "plans"],
	},
	{
		slug: "plans",
		section: "account",
		next: ["over-plan-limits", "export"],
	},
	{
		slug: "appearance",
		section: "account",
		next: ["keyboard-shortcuts", "reading"],
	},
	{
		slug: "export",
		section: "account",
		next: ["import-opml", "plans"],
	},
	{
		slug: "no-feed-found",
		section: "fix",
		next: ["feeds", "import-opml"],
	},
	{
		slug: "feed-not-updating",
		section: "fix",
		next: ["feeds", "notifications"],
	},
	{
		slug: "search-missing-post",
		section: "fix",
		next: ["search", "plans"],
	},
	{
		slug: "article-not-loading",
		section: "fix",
		next: ["reading", "plans"],
	},
	{
		slug: "over-plan-limits",
		section: "fix",
		next: ["plans", "export"],
	},
];

/** The page a slug names, or `undefined` for one Reader never published. */
export function findDocPage(slug: string): DocPage | undefined {
	return DOC_PAGES.find((page) => page.slug === slug);
}

/**
 * A page's body in the reader's language, or in English when that language has none.
 *
 * @example let module = await loadDocBody("folders", ctx.locale);
 */
export function loadDocBody(slug: string, locale: string): Promise<DocModule> {
	let load =
		BODIES[`./pages/${locale}/${slug}.tsx`] ?? BODIES[`./pages/${SOURCE_LOCALE}/${slug}.tsx`];
	if (!load) return Promise.reject(new Error(`No help page body for ${slug}`));
	return load();
}

/** The address of a help page. */
export function docHref(slug: string): string {
	return routes.docs.show.href({ slug });
}

/** A page's title in the reader's language. */
export function pageTitle(t: Translate, slug: string): string {
	return t(`docs.pages.${slug}.title`);
}

/** A page's one-line description in the reader's language. */
export function pageDescription(t: Translate, slug: string): string {
	return t(`docs.pages.${slug}.description`);
}

/** A section's name in the reader's language. */
export function sectionTitle(t: Translate, key: DocSectionKey): string {
	return t(`docs.sections.${key}.title`);
}

/** A section's one-line summary in the reader's language. */
export function sectionDescription(t: Translate, key: DocSectionKey): string {
	return t(`docs.sections.${key}.description`);
}

/** A page as a link card: its title, address and description, in the reader's language. */
export function pageLink(t: Translate, slug: string) {
	return { title: pageTitle(t, slug), href: docHref(slug), description: pageDescription(t, slug) };
}

/** The sidebar's tree: one section per group, its pages in the order above. */
export function docsTree(t: Translate, label: string): DocsTree {
	return {
		label,
		sections: DOC_SECTIONS.map((key) => ({
			title: sectionTitle(t, key),
			items: DOC_PAGES.filter((page) => page.section === key).map((page) => ({
				title: pageTitle(t, page.slug),
				href: docHref(page.slug),
			})),
		})),
	};
}
