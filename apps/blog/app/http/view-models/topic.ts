/**
 * View model for topic pages, the topic index and topic feeds. Turns a topic and the posts
 * its query found into rows drawn the way each kind's own listing draws them, with the
 * topic's addresses and pager, and into the format-neutral entries every feed format writes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Pagination } from "@sdxc/pagination";

import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";
import { isFailure } from "@sdxc/result";

import type { NotFoundViewModel } from "~/app/http/view-models/not-found";
import type { Syndication } from "~/app/http/view-models/syndication";
import type { Kind } from "~/app/models/kinds";
import type { TopicPost } from "~/app/services/topics";
import type { SelectTopic } from "~/database/schema";

import { BookmarksViewModel } from "~/app/http/view-models/bookmarks";
import { FeedViewModel } from "~/app/http/view-models/feed";
import { GlossaryViewModel } from "~/app/http/view-models/glossary";
import { SearchViewModel } from "~/app/http/view-models/search";
import {
	bookmarkEntry,
	glossaryEntry,
	iso,
	noteEntry,
	pageEntry,
	tilEntry,
} from "~/app/http/view-models/syndication";
import { POST_KINDS } from "~/app/models/kinds";
import { isBuiltInTopic } from "~/app/models/topics";
import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/** Contracts for the topic templates: one row per post, and the page and index around them. */
export namespace TopicViewModel {
	/**
	 * One post on a topic page, drawn as its kind's own listing draws it: an article or a
	 * tutorial as a linked title and date, a bookmark with its summary and archive link, a
	 * glossary entry with its definition, a note or TIL as an activity row reading its content,
	 * and any other kind as an activity row.
	 */
	export type Item =
		| { type: "page"; key: string; href: string; label: string; date: string; preview: boolean }
		| { type: "bookmark"; key: string; bookmark: BookmarksViewModel.Item }
		| { type: "entry"; key: string; entry: GlossaryViewModel.Entry }
		| {
				type: "activity";
				key: string;
				kind: Kind;
				kindLabel: string;
				href: string;
				label: string;
				description: string | null;
				date: string | null;
				/** A note's or TIL's content, read in the row with the date as its link. */
				inline?: FeedViewModel.Inline;
		  };

	/** A topic's three feeds. */
	export interface Feeds {
		rss: string;
		atom: string;
		json: string;
	}

	/** Everything a topic page renders. */
	export interface Page {
		title: string;
		/** The description as Markdown parsed for rendering, `null` when it is blank. */
		description: Markdown.Document | null;
		/** The description as one line of plain text, for the document's meta description. */
		summary: string;
		/** The page's own path, which the navigation marks as current. */
		path: string;
		feeds: Feeds;
		/** Whom the subscribe line names: "my articles" for a kind's topic, else the title. */
		subscribeTo: string;
		/** What the page says when the topic lists nothing yet. */
		empty: string;
		items: Array<Item>;
		/** Whether every row is a glossary entry, which the page lists as a definition list. */
		entries: boolean;
		/** `null` when every match fits on one page. */
		pager: SearchViewModel.Pager | null;
	}

	/** One topic on the topic index. */
	export interface IndexItem {
		href: string;
		title: string;
		summary: string;
	}
}

/** What a topic's page or feed URL answers when no topic lives at it. */
export const TOPIC_NOT_FOUND: NotFoundViewModel.Input = {
	title: "Topic Not Found",
	description: "No topic lives at this address.",
	emoji: "🔎",
};

/** Builds topic pages, the topic index and topic feeds from what a controller loaded. */
export class TopicViewModel {
	/**
	 * A topic page. A kind's topic speaks as the kind's own page did ("my articles", "No
	 * articles yet."); any other names itself by its title.
	 *
	 * @param input The topic, the posts on this page, the paging (`null` when every post is
	 * listed at once) and the request URL the pager's links keep.
	 */
	static page(input: {
		topic: SelectTopic;
		posts: ReadonlyArray<TopicPost>;
		pagination: Pagination | null;
		url: URL;
	}): TopicViewModel.Page {
		let { topic, pagination } = input;
		let builtIn = isBuiltInTopic(topic.slug);
		let items = input.posts.map((post) => this.item(post));
		let description = parse(topic.description);

		return {
			title: topic.title,
			description,
			summary: description === null ? topic.title : oneLine(toPlainText(description)),
			path: topicPath(topic),
			feeds: topicFeeds(topic),
			subscribeTo: builtIn ? `my ${topic.title.toLowerCase()}` : topic.title,
			empty: builtIn ? `No ${topic.title.toLowerCase()} yet.` : "No posts yet.",
			items,
			entries: items.length > 0 && items.every((item) => item.type === "entry"),
			pager:
				pagination !== null && pagination.pages > 1
					? SearchViewModel.pager(pagination, input.url)
					: null,
		};
	}

	/**
	 * Every topic, linked to its page with its description as one line of plain text.
	 *
	 * @param topics The topics, in the order to list them.
	 */
	static index(topics: ReadonlyArray<SelectTopic>): Array<TopicViewModel.IndexItem> {
		return topics.map((topic) => {
			let description = parse(topic.description);
			return {
				href: topicPath(topic),
				title: topic.title,
				summary: description === null ? "" : oneLine(toPlainText(description)),
			};
		});
	}

	/**
	 * The channel and entries of a topic's feeds, in the order its posts arrive, each entry
	 * as the kind's own feed wrote it; any other kind is written from its search result.
	 *
	 * @param topic The topic the feed follows.
	 * @param posts The topic's posts, newest first.
	 * @param base The request URL, which every link resolves against.
	 */
	static feed(
		topic: SelectTopic,
		posts: ReadonlyArray<TopicPost>,
		base: URL,
	): { channel: Syndication.Channel; entries: Array<Syndication.Entry> } {
		return {
			channel: {
				title: `${topic.title} — ${PROFILE.name}`,
				description: `${topic.title} by ${PROFILE.name}.`,
				home: new URL(topicPath(topic), base).toString(),
			},
			entries: posts.map((post) => feedEntry(post, base)),
		};
	}

	/**
	 * Where each of a post's tags links: the topic listing exactly that tag when there is one,
	 * else the search for the tag, so a reader always lands on every post carrying it.
	 *
	 * @param tags The post's tags.
	 * @param topics The topics listing exactly one tag, keyed by the tag as the post stores it.
	 */
	static tagHrefs(
		tags: ReadonlyArray<string>,
		topics: ReadonlyMap<string, Pick<SelectTopic, "slug">>,
	): Record<string, string> {
		return Object.fromEntries(
			tags.map((tag) => {
				let topic = topics.get(tag);
				if (topic) return [tag, topicPath(topic)];
				return [tag, `${routes.search.href()}?${new URLSearchParams({ q: `tag:"${tag}"` })}`];
			}),
		);
	}

	/** One post's row, as its kind's listing draws it. */
	private static item(post: TopicPost): TopicViewModel.Item {
		let { hit } = post;
		switch (post.kind) {
			case "article":
			case "tutorial":
				return {
					type: "page",
					key: hit.id,
					href: hit.url,
					label: hit.title,
					date: post.post.published_at ?? post.post.created_at,
					preview: false,
				};
			case "bookmark":
				return { type: "bookmark", key: hit.id, bookmark: BookmarksViewModel.item(post.post) };
			case "glossary":
				return { type: "entry", key: hit.id, entry: GlossaryViewModel.entry(post.post) };
			case "note":
			case "til":
				return {
					type: "activity",
					key: hit.id,
					kind: post.kind,
					kindLabel: POST_KINDS[post.kind].label,
					href: hit.url,
					label: hit.title,
					description: null,
					date: hit.publishedAt,
					inline: FeedViewModel.inline(post.kind, post.post.meta),
				};
			case "other":
				return {
					type: "activity",
					key: hit.id,
					kind: hit.kind,
					kindLabel: POST_KINDS[hit.kind].label,
					href: hit.url,
					label: hit.title,
					description: hit.excerpt?.trim() || null,
					date: hit.publishedAt,
				};
		}
	}
}

/**
 * Where a topic's page lives: a kind's topic at the root (`/articles`), as the registry names
 * it, and an author's topic under `/topics/`.
 *
 * @param topic The topic, by its slug.
 */
export function topicPath(topic: Pick<SelectTopic, "slug">): string {
	if (isBuiltInTopic(topic.slug)) return `/${topic.slug}`;
	return routes.topic.href({ slug: topic.slug });
}

/**
 * A topic's three feeds, beside its page: `/<slug>.rss` for a kind's topic and
 * `/topics/<slug>.rss` for an author's, and likewise for Atom and JSON Feed.
 *
 * @param topic The topic, by its slug.
 */
export function topicFeeds(topic: Pick<SelectTopic, "slug">): TopicViewModel.Feeds {
	if (isBuiltInTopic(topic.slug)) {
		return {
			rss: routes.rss.topic.href({ topic: topic.slug }),
			atom: routes.atom.topic.href({ topic: topic.slug }),
			json: routes.jsonFeed.topic.href({ topic: topic.slug }),
		};
	}
	return {
		rss: routes.topic.href({ slug: topic.slug, ext: "rss" }),
		atom: routes.topic.href({ slug: topic.slug, ext: "atom" }),
		json: routes.topic.href({ slug: topic.slug, ext: "json" }),
	};
}

/** One post's feed entry, as its kind's own feed writes it. */
function feedEntry(post: TopicPost, base: URL): Syndication.Entry {
	switch (post.kind) {
		case "article":
			return pageEntry(post.post, "articles", base);
		case "tutorial":
			return pageEntry(post.post, "tutorials", base);
		case "bookmark":
			return bookmarkEntry(post.post);
		case "glossary":
			return glossaryEntry(post.post, base);
		case "note":
			return noteEntry(post.post, base);
		case "til":
			return tilEntry(post.post, base);
		case "other": {
			let url = new URL(post.hit.url, base).toString();
			return {
				id: post.post.id,
				title: post.hit.title,
				summary: post.hit.excerpt?.trim() || url,
				url,
				published: iso(post.post.published_at ?? post.post.created_at),
				updated: iso(post.post.updated_at),
			};
		}
	}
}

/** A description's Markdown parsed for rendering, `null` when blank or unparseable. */
function parse(markdown: string): Markdown.Document | null {
	if (markdown.trim() === "") return null;
	let parsed = Markdown.parse(markdown);
	return isFailure(parsed) ? null : parsed.data.document;
}

/** Text with its whitespace collapsed to single spaces. */
function oneLine(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}
