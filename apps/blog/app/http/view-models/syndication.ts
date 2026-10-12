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
import type { Note } from "~/app/models/notes";
import type { Til } from "~/app/models/tils";
import type { Tutorial } from "~/app/models/tutorials";

import { bookmarkLabel, noteTitle, plainText } from "~/app/models/post-values";
import routes from "~/routes/web";

/** Type contracts shared by the feed controllers. */
export namespace Syndication {
	/**
	 * A feed's content: `feed` is the whole site, notes, TILs and glossary terms included;
	 * the others carry one content type each.
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
				description:
					"Articles, tutorials, notes, TILs, bookmarks, and glossary terms by Sergio Xalambrí.",
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

	let [articles, tutorials, likes, glossary, notes, tils, releases] = await Promise.all([
		carries("articles") ? models.articles.findAll({ includePreview: false }) : [],
		carries("tutorials") ? models.tutorials.findAll({ includePreview: false }) : [],
		carries("bookmarks") ? models.likes.findAll() : [],
		stream === "feed" ? models.glossary.findAll() : [],
		stream === "feed" ? models.notes.findAll({ includePreview: false }) : [],
		stream === "feed" ? models.tils.findAll({ includePreview: false }) : [],
		stream === "feed" ? models.releases.findAll({ includePreview: false }) : [],
	]);

	let entries: Syndication.Entry[] = [];

	for (let [postType, posts] of [
		["articles", articles],
		["tutorials", tutorials],
	] as const) {
		for (let post of posts) entries.push(pageEntry(post, postType, base));
	}

	for (let note of notes) entries.push(noteEntry(note, base));

	for (let til of tils) entries.push(tilEntry(til, base));

	for (let release of releases) {
		entries.push({
			id: release.id,
			title: `${release.meta.title} (${release.meta.slug.toUpperCase()})`,
			summary: plainText(release.meta.content),
			url: new URL(
				routes.post.href({ postType: "releases", postSlug: release.meta.slug }),
				base,
			).toString(),
			published: iso(release.published_at ?? release.created_at),
			updated: iso(release.updated_at),
		});
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

/**
 * A note's item: titled by its content shortened, since Atom requires a title and a note has
 * none, and summarized by its whole content as plain text.
 *
 * @param note The note.
 * @param base The request URL, which the link resolves against.
 */
export function noteEntry(note: Note, base: URL): Syndication.Entry {
	let path = routes.post.href({ postType: "notes", postSlug: note.meta.slug });
	return {
		id: note.id,
		title: noteTitle(note.meta.content),
		summary: plainText(note.meta.content),
		url: new URL(path, base).toString(),
		published: iso(note.published_at ?? note.created_at),
		updated: iso(note.updated_at),
	};
}

/**
 * A TIL's item, titled "TIL" and its title and summarized by its content as plain text.
 *
 * @param til The TIL.
 * @param base The request URL, which the link resolves against.
 */
export function tilEntry(til: Til, base: URL): Syndication.Entry {
	let path = routes.post.href({ postType: "til", postSlug: til.meta.slug });
	return {
		id: til.id,
		title: `TIL ${til.meta.title}`,
		summary: plainText(til.meta.content),
		url: new URL(path, base).toString(),
		published: iso(til.published_at ?? til.created_at),
		updated: iso(til.updated_at),
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
