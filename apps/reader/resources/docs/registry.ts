/**
 * Every help page Reader publishes, in the order a new reader meets them: its section, its
 * title as the task or the symptom, the plan it needs, and where it hands the reader next.
 * The sidebar, the hub, the pager-free "Up next" and the 404 all read this one list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { DocsTree } from "@sdxc/ui/utils";
import type { Handle, RemixNode } from "remix/component";

import type { DocBody } from "~/resources/docs/blocks";

import routes from "~/routes/web";

/** The sidebar's groups, in the order a reader's first week runs through them. */
export const DOC_SECTIONS = [
	{
		key: "start",
		title: "Get started",
		description: "Sign in, follow your first feeds, or bring them from another reader.",
	},
	{
		key: "read",
		title: "Read",
		description: "Work through the queue, look after each feed, and read without the mouse.",
	},
	{
		key: "keep",
		title: "Keep and organise",
		description:
			"Save posts, label them, pin feeds, file them into folders, and filter what arrives.",
	},
	{
		key: "find",
		title: "Find",
		description: "Search everything you follow, and keep the searches you repeat.",
	},
	{
		key: "reach",
		title: "Notifications and agents",
		description: "Hear about the feeds you pick, and let an assistant read your queue.",
	},
	{
		key: "account",
		title: "Your account",
		description: "Plans and limits, how Reader looks, and taking everything with you.",
	},
	{
		key: "fix",
		title: "Fix a problem",
		description:
			"A feed that will not follow or update, a search that misses, a plan you are over.",
	},
] as const;

export type DocSectionKey = (typeof DOC_SECTIONS)[number]["key"];

/** What a page's module provides: its headings for the rail, and the body that draws them. */
export interface DocModule {
	TOC: TableOfContents.Item[];
	default: (handle: Handle<DocBody.Props>) => () => RemixNode;
}

export interface DocPage {
	slug: string;
	title: string;
	/** The one sentence under the title, saying what the page gets the reader. */
	description: string;
	section: DocSectionKey;
	/** The lowest plan the page's feature needs; absent when every plan has it. */
	plan?: "paid" | "premium";
	/** Hand-picked pages that follow from this task, drawn as "Up next". */
	next: string[];
	load: () => Promise<DocModule>;
}

/** The pages, sidebar order; a page's slug is its address under `/docs/`. */
export const DOC_PAGES: DocPage[] = [
	{
		slug: "getting-started",
		title: "Start reading",
		description: "Sign in, follow your first feed, and read your first post, in about two minutes.",
		section: "start",
		next: ["import-opml", "reading", "keyboard-shortcuts"],
		load: () => import("~/resources/docs/pages/getting-started"),
	},
	{
		slug: "import-opml",
		title: "Import from another reader",
		description: "Export an OPML file from your old reader and follow everything in it at once.",
		section: "start",
		next: ["folders", "reading"],
		load: () => import("~/resources/docs/pages/import-opml"),
	},
	{
		slug: "reading",
		title: "Read your queue",
		description:
			"Every post from every feed, newest first: narrow it, mark it read, and open a post.",
		section: "read",
		next: ["keyboard-shortcuts", "saving", "feeds"],
		load: () => import("~/resources/docs/pages/reading"),
	},
	{
		slug: "feeds",
		title: "Follow and manage feeds",
		description: "Follow a site, check it now, choose how long its posts stay, or unfollow it.",
		section: "read",
		next: ["pins", "folders", "feed-not-updating"],
		load: () => import("~/resources/docs/pages/feeds"),
	},
	{
		slug: "keyboard-shortcuts",
		title: "Keyboard shortcuts",
		description: "Every key Reader answers while you read, and how to see them on screen.",
		section: "read",
		next: ["search", "saving"],
		load: () => import("~/resources/docs/pages/keyboard-shortcuts"),
	},
	{
		slug: "saving",
		title: "Save posts",
		description: "Keep a post past every rule that would remove it, and find it again on Saved.",
		section: "keep",
		next: ["labels", "export"],
		load: () => import("~/resources/docs/pages/saving"),
	},
	{
		slug: "labels",
		title: "Label saved posts",
		description: "Put a label on what you keep, and read everything under one label as a list.",
		section: "keep",
		plan: "paid",
		next: ["search", "export"],
		load: () => import("~/resources/docs/pages/labels"),
	},
	{
		slug: "pins",
		title: "Pin feeds above your queue",
		description: "Keep the feeds you never want to miss in a strip at the top of Reading.",
		section: "keep",
		next: ["folders", "notifications"],
		load: () => import("~/resources/docs/pages/pins"),
	},
	{
		slug: "folders",
		title: "Group feeds into folders",
		description: "File feeds under a name and read the whole folder as one stream.",
		section: "keep",
		plan: "paid",
		next: ["filters", "import-opml"],
		load: () => import("~/resources/docs/pages/folders"),
	},
	{
		slug: "filters",
		title: "Filter posts as they arrive",
		description: "Drop, mark read or flag a post by what its title, link, summary or author says.",
		section: "keep",
		plan: "paid",
		next: ["notifications", "search"],
		load: () => import("~/resources/docs/pages/filters"),
	},
	{
		slug: "search",
		title: "Search your posts",
		description: "Find posts by their words, combine words with OR and minus, and save a search.",
		section: "find",
		next: ["search-missing-post", "labels"],
		load: () => import("~/resources/docs/pages/search"),
	},
	{
		slug: "notifications",
		title: "Get notified about new posts",
		description: "Pick the feeds worth interrupting you for, and choose how and when you hear.",
		section: "reach",
		plan: "paid",
		next: ["pins", "filters"],
		load: () => import("~/resources/docs/pages/notifications"),
	},
	{
		slug: "agents",
		title: "Connect an AI assistant",
		description: "Mint a token and let an assistant read, search and act on your queue over MCP.",
		section: "reach",
		plan: "paid",
		next: ["search", "plans"],
		load: () => import("~/resources/docs/pages/agents"),
	},
	{
		slug: "plans",
		title: "Plans and limits",
		description: "What Free, Paid and Premium each keep and do, and how to change plans.",
		section: "account",
		next: ["over-plan-limits", "export"],
		load: () => import("~/resources/docs/pages/plans"),
	},
	{
		slug: "appearance",
		title: "Change how Reader looks",
		description: "Choose light or dark colours and a serif or sans face for what you read.",
		section: "account",
		next: ["keyboard-shortcuts", "reading"],
		load: () => import("~/resources/docs/pages/appearance"),
	},
	{
		slug: "export",
		title: "Export your data",
		description: "Download your subscriptions as OPML, or everything you keep as one ZIP.",
		section: "account",
		next: ["import-opml", "plans"],
		load: () => import("~/resources/docs/pages/export"),
	},
	{
		slug: "no-feed-found",
		title: "Reader says a site has no feed",
		description: "What to try when following a site's address answers that it publishes no feed.",
		section: "fix",
		next: ["feeds", "import-opml"],
		load: () => import("~/resources/docs/pages/no-feed-found"),
	},
	{
		slug: "feed-not-updating",
		title: "A feed stopped updating",
		description: "Read what its last check found, check it now, and know when to wait.",
		section: "fix",
		next: ["feeds", "notifications"],
		load: () => import("~/resources/docs/pages/feed-not-updating"),
	},
	{
		slug: "search-missing-post",
		title: "Search can't find a post I know is there",
		description: "Why a search stops where it does, and the three things that make it miss.",
		section: "fix",
		next: ["search", "plans"],
		load: () => import("~/resources/docs/pages/search-missing-post"),
	},
	{
		slug: "article-not-loading",
		title: "The article won't load in Reader",
		description: "What each message under a post means, and how to read the piece anyway.",
		section: "fix",
		next: ["reading", "plans"],
		load: () => import("~/resources/docs/pages/article-not-loading"),
	},
	{
		slug: "over-plan-limits",
		title: "I'm over my plan's limits",
		description: "Nothing is deleted. What pauses, and the two ways back inside your plan.",
		section: "fix",
		next: ["plans", "export"],
		load: () => import("~/resources/docs/pages/over-plan-limits"),
	},
];

/** The page a slug names, or `undefined` for one Reader never published. */
export function findDocPage(slug: string): DocPage | undefined {
	return DOC_PAGES.find((page) => page.slug === slug);
}

/** The address of a help page. */
export function docHref(slug: string): string {
	return routes.docs.show.href({ slug });
}

/** The title a section key prints. */
export function sectionTitle(key: DocSectionKey): string {
	return DOC_SECTIONS.find((section) => section.key === key)?.title ?? key;
}

/** The sidebar's tree: one section per group, its pages in the order above. */
export function docsTree(label: string): DocsTree {
	return {
		label,
		sections: DOC_SECTIONS.map((section) => ({
			title: section.title,
			items: DOC_PAGES.filter((page) => page.section === section.key).map((page) => ({
				title: page.title,
				href: docHref(page.slug),
			})),
		})),
	};
}
