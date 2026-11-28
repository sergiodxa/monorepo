/**
 * The demo blogs `/showcase/:slug/demo` serves, discovered from
 * `resources/views/demo-blogs/<blog>/index.tsx` and each loaded only when one of its own
 * pages is asked for. A blog's posts are Markdown files with front matter beside its record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import type { DemoBlogArticle, DemoBlogPost } from "~/app/services/demo-blogs";
import type { PaletteScale } from "~/resources/components/demo-theme";

import routes from "~/routes/web";

/** The page a blog's newsletter form posts to and its confirmation renders on. */
export const SUBSCRIBE_PAGE = "subscribe";

/** The page that lists every post by year. */
export const ARCHIVE_PAGE = "archive";

/** The page that lists every tag, and the prefix of each tag's own page. */
export const TAGS_PAGE = "tags";

/** The blog's RSS feed, a path a feed reader is pointed at. */
export const FEED_PAGE = "rss.xml";

/** The about page. */
export const ABOUT_PAGE = "about";

/** The search page, which reads `?q=` and narrows by `?type=`. */
export const SEARCH_PAGE = "search";

/** The four shapes a post takes, which decide its row in a stream and its page. */
export type DemoBlogLayout = "article" | "note" | "bookmark" | "term";

/** One kind of post a blog publishes, such as its articles or its bookmarks. */
export interface DemoBlogKind {
	/** The kind's page title and nav label ("Tutorials"). */
	label: string;
	/** One post of the kind, as its eyebrow reads ("Tutorial"). */
	singular: string;
	/** What the kind's page says it collects, under its title. */
	description: string;
	/**
	 * How the kind's posts are drawn in a stream and on their page: `article` as long-form
	 * reading, `note` in full wherever it is listed, `bookmark` as a link out with a comment,
	 * `term` as a glossary entry indexed A to Z.
	 * @default "article"
	 */
	layout?: DemoBlogLayout;
}

/** The person writing the blog, as the byline, the about page and the footer name them. */
export interface DemoBlogAuthor {
	name: string;
	/** What they do, under their name ("Platform engineer in Lisbon"). */
	role: string;
	/** Two or three sentences for the home's intro and the end of every article. */
	bio: string;
	/** The initials the portrait falls back to. */
	initials: string;
	/** Profiles elsewhere, linked from the about page and the footer. */
	links: Array<{ label: string; href: string }>;
}

/** One blog demo: its invented author, its art direction, its kinds and its posts. */
export interface DemoBlogSite {
	/** The blog's name, which the header's wordmark and every title carry. */
	name: string;
	/** Which kind of blog the demo shows ("Personal blog"), for the cards that link to it. */
	kind: string;
	/** A few words on what the blog is about, under the wordmark and on the gallery card. */
	tagline: string;
	/** A few words on the palette, type and shapes the blog commits to. */
	artDirection: string;
	/** One sentence for the meta description and the feed's channel. */
	description: string;
	/** The blog's mark, drawn before its name in the header. */
	mark: () => RemixNode;
	/** The palettes and tokens the whole blog is themed with. */
	theme: {
		brand: PaletteScale;
		neutral?: PaletteScale;
		tokens?: Record<`--${string}`, string>;
	};
	author: DemoBlogAuthor;
	/** Every kind of post keyed by the path segment its posts live under ("tutorials"). */
	kinds: Record<string, DemoBlogKind>;
	/** What a tag's page says it collects, keyed by tag; a tag without one gets a count alone. */
	tags: Record<string, string>;
	/** Every post's Markdown source, keyed by its slug. */
	posts: Record<string, () => Promise<string>>;
	/** The about page's body, after its header. */
	about: () => RemixNode;
	/** How many posts one page of the feed holds before "Older" pages on. */
	pageSize: number;
	/**
	 * Draws one page of the blog, from its own header to its own footer, in the blog's own
	 * design. The controller has already read, filtered and paged every post the page needs.
	 */
	render: (view: DemoBlogView, context: DemoBlogContext) => RemixNode;
}

/** What every page of a blog is drawn with, whichever view it is. */
export interface DemoBlogContext {
	site: DemoBlogSite;
	slug: string;
	/** Builds an address under the blog from a page path; none is the feed. */
	href: (page?: string) => string;
	/** Every post, newest first, for sidebars, counts and archives on any page. */
	posts: DemoBlogPost[];
}

/** One page of the feed, the blog's index at `/`, with every kind mixed in date order. */
export interface DemoBlogFeedView {
	view: "feed";
	/** The posts on this page, after the type and tag filters. */
	feed: DemoBlogPost[];
	/** The `?type=` the feed is narrowed to, `null` for everything. */
	type: string | null;
	/** Counted from 1, from `?page=`. */
	page: number;
	pageCount: number;
	/** Builds the address of another page of the same filtered feed. */
	pageHref: (page: number) => string;
	/** The post the blog leads with, on the first unfiltered page only. */
	featured: DemoBlogPost | null;
}

/** One post's page, with everything around it a reader moves on to. */
export interface DemoBlogPostView {
	view: "post";
	article: DemoBlogArticle;
	/** The post published before this one and the one after, `null` at either end. */
	older: DemoBlogPost | null;
	newer: DemoBlogPost | null;
	related: DemoBlogPost[];
	/** Every part of the post's series in order; empty for a post in no series. */
	series: DemoBlogPost[];
}

/** Every page a blog draws. */
export type DemoBlogView =
	| DemoBlogFeedView
	| DemoBlogPostView
	| {
			view: "archive";
			/** Every post of the `?type=` filter, newest first, which the page groups by year. */
			posts: DemoBlogPost[];
			type: string | null;
	  }
	| { view: "tags"; tags: Array<{ tag: string; count: number }> }
	| { view: "tag"; tag: string; posts: DemoBlogPost[] }
	| {
			view: "search";
			query: string;
			type: string | null;
			/** Every match before the type filter, which the filter's counts read. */
			matches: DemoBlogPost[];
			/** The matches the type filter keeps. */
			results: DemoBlogPost[];
	  }
	| { view: "about" }
	| { view: "subscribe"; sent: boolean }
	| { view: "not-found"; path: string };

/** One blog demo as a page linking to it lists it. */
export interface DemoBlogSummary {
	slug: string;
	name: string;
	kind: string;
	description: string;
	tagline: string;
	artDirection: string;
}

/**
 * Every blog demo folder's entry, keyed by its path relative to this file. A new demo is one
 * folder holding an `index.tsx`; its folder name is its slug.
 */
const SITE_MODULES = import.meta.glob<DemoBlogSite>("./*/index.tsx", { import: "default" });

/**
 * Loads the blog demo a slug names.
 *
 * @param slug The `:slug` the request carried.
 * @returns The blog, or `null` for a slug no folder answers to.
 */
export async function findDemoBlogSite(slug: string): Promise<DemoBlogSite | null> {
	let key = `./${slug}/index.tsx`;
	if (!Object.hasOwn(SITE_MODULES, key)) return null;
	return (await SITE_MODULES[key]?.()) ?? null;
}

/**
 * The slugs the blog demos answer under `/showcase/:slug/demo`, in folder-name order.
 *
 * @returns One slug per blog demo folder.
 */
export function listDemoBlogSlugs(): string[] {
	return Object.keys(SITE_MODULES)
		.map((key) => key.slice(2, -"/index.tsx".length))
		.sort();
}

/**
 * Builds the addresses of one blog demo, so its pages name each other by their path.
 *
 * @param slug The demo's folder name.
 * @returns A function from a page path (none for the home) to its address.
 * @example demoBlogHref("lowtide")("articles/cache-keys") // "/showcase/lowtide/demo/articles/cache-keys"
 */
export function demoBlogHref(slug: string): (page?: string) => string {
	return (page) => routes.showcase.demo.href({ slug, page });
}
