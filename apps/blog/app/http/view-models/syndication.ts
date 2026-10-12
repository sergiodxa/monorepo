/**
 * View model for the syndication feeds. Describes each feed stream's channel and loads
 * its published items into one format-neutral, newest-first entry list, so the RSS, Atom,
 * and JSON Feed documents for a stream carry the same items with the same links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BlogModels } from "~/app/models";
import type { Article } from "~/app/models/articles";
import type { GlossaryEntry } from "~/app/models/glossary";
import type { Like } from "~/app/models/likes";
import type { Tutorial } from "~/app/models/tutorials";

import { bookmarkLabel } from "~/app/models/post-values";
import routes from "~/routes/web";

/** Type contracts shared by the feed controllers. */
export namespace Syndication {
	/**
	 * A feed's content: `feed` is the whole site, glossary terms included; the others
	 * carry one content type each.
	 */
	export type Stream = "feed" | "articles" | "tutorials" | "bookmarks";

	/** A feed's own metadata, identical across formats. */
	export interface Channel {
		title: string;
		description: string;
		/** The absolute URL of the HTML page the feed mirrors. */
		home: string;
	}

	/**
	 * One feed item. `url` is absolute, since readers resolve it outside the origin that
	 * served the feed, and a bookmark's `url` is the saved page itself.
	 */
	export interface Entry {
		/** The post id, stable across edits, which readers deduplicate by. */
		id: string;
		/** A bookmark without a title is named by its address, so no item reads blank. */
		title: string;
		/** A bookmark's is its URL, preceded by its description and a blank line when it has one. */
		summary: string;
		url: string;
		/** ISO-8601; `published_at` when set, `created_at` for posts published immediately. */
		published: string;
		/** ISO-8601 time of the last edit. */
		updated: string;
	}
}

/**
 * The channel metadata for a stream, with `home` resolved against the request.
 *
 * @param stream The feed's content stream.
 * @param base The request URL.
 */
export function syndicationChannel(stream: Syndication.Stream, base: URL): Syndication.Channel {
	switch (stream) {
		case "feed":
			return {
				title: "Sergio Xalambrí",
				description: "Articles, tutorials, bookmarks, and glossary terms by Sergio Xalambrí.",
				home: base.origin,
			};
		case "articles":
			return {
				title: "Articles — Sergio Xalambrí",
				description: "Articles by Sergio Xalambrí.",
				home: new URL(routes.articles.href(), base).toString(),
			};
		case "tutorials":
			return {
				title: "Tutorials — Sergio Xalambrí",
				description: "Tutorials by Sergio Xalambrí.",
				home: new URL(routes.tutorials.href(), base).toString(),
			};
		case "bookmarks":
			return {
				title: "Bookmarks — Sergio Xalambrí",
				description: "Bookmarks by Sergio Xalambrí.",
				home: new URL(routes.bookmarks.href(), base).toString(),
			};
	}
}

/**
 * Loads a stream's public items, newest first, querying only the content types the stream
 * carries. Future-dated articles and tutorials stay out, following `isPublishedAt`.
 *
 * @param db The tenant database.
 * @param base The request URL, which item links resolve against.
 * @param stream The feed's content stream.
 * @returns The entries, sorted by publish date descending.
 */
export async function syndicationEntries(
	models: BlogModels,
	base: URL,
	stream: Syndication.Stream,
): Promise<Syndication.Entry[]> {
	let carries = (type: Syndication.Stream) => stream === "feed" || stream === type;

	let [articles, tutorials, likes, glossary] = await Promise.all([
		carries("articles") ? models.articles.findAll({ includePreview: false }) : [],
		carries("tutorials") ? models.tutorials.findAll({ includePreview: false }) : [],
		carries("bookmarks") ? models.likes.findAll() : [],
		stream === "feed" ? models.glossary.findAll() : [],
	]);

	let entries: Syndication.Entry[] = [];

	for (let [postType, posts] of [
		["articles", articles],
		["tutorials", tutorials],
	] as const) {
		for (let post of posts) entries.push(pageEntry(post, postType, base));
	}

	for (let like of likes) entries.push(bookmarkEntry(like));

	for (let term of glossary) entries.push(glossaryEntry(term, base));

	return entries.sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
}

/**
 * An article's or tutorial's item, linking to its page and summarized by its excerpt, or by
 * that link while it has none.
 *
 * @param post The article or tutorial.
 * @param postType The topic its page lives under.
 * @param base The request URL, which the link resolves against.
 */
export function pageEntry(
	post: Article | Tutorial,
	postType: "articles" | "tutorials",
	base: URL,
): Syndication.Entry {
	let url = new URL(routes.post.href({ postType, postSlug: post.meta.slug }), base).toString();
	return {
		id: post.id,
		title: post.meta.title,
		summary: post.meta.excerpt ?? url,
		url,
		published: iso(post.published_at ?? post.created_at),
		updated: iso(post.updated_at),
	};
}

/** A bookmark's item, pointing at the page it saved and dated by when it was saved. */
export function bookmarkEntry(like: Like): Syndication.Entry {
	return {
		id: like.id,
		title: bookmarkLabel(like.meta),
		summary: bookmarkSummary(like.meta),
		url: like.meta.url,
		published: iso(like.created_at),
		updated: iso(like.updated_at),
	};
}

/**
 * A glossary entry's item, linking to its anchor on the glossary page and titled by its term
 * with its alias.
 *
 * @param term The glossary entry.
 * @param base The request URL, which the link resolves against.
 */
export function glossaryEntry(term: GlossaryEntry, base: URL): Syndication.Entry {
	return {
		id: term.id,
		title: term.meta.title ? `${term.meta.term} (aka ${term.meta.title})` : term.meta.term,
		summary: term.meta.definition,
		url: new URL(`${routes.glossary.href()}#${term.meta.slug}`, base).toString(),
		published: iso(term.created_at),
		updated: iso(term.updated_at),
	};
}

/**
 * A bookmark's description, then its URL on a line of its own, so a reader shows what the page
 * is about before the link; the URL alone while the bookmark has no description.
 */
function bookmarkSummary(meta: Like["meta"]): string {
	let description = meta.description.trim();
	if (description === "") return meta.url;
	return `${description}\n\n${meta.url}`;
}

/** Normalizes a stored timestamp to the RFC 3339 form Atom and JSON Feed both require. */
export function iso(value: string): string {
	return new Date(value).toISOString();
}
