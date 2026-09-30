/**
 * View model for public post pages. It maps article and tutorial payloads into the one
 * page contract the post route renders, so post-type branching, canonical URL selection,
 * meta generation, and markdown parsing stay out of the controller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatDate, parseDate } from "@sdxc/dates";
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { isSuccess, succeeded } from "@sdxc/result";

import type { Webmention } from "~/app/repositories/webmention";

import { Post } from "~/app/repositories/post";
import { hostOf } from "~/app/repositories/webmention";

/**
 * Type contracts used to build the post page view model.
 *
 * These contracts model the normalized shape consumed by the post controller and
 * blog layout regardless of whether the source is an article or a tutorial.
 */
export namespace PostViewModel {
	/**
	 * Normalized page payload rendered by the post route.
	 *
	 * The view consumes this object for both HTML markup and meta tag generation,
	 * so fields here act as the rendering contract for post responses.
	 */
	export interface Page {
		title: string;
		description: string;
		activePath: string;
		/** Preferred URL for indexing; may differ from the request URL. */
		canonical: string;
		/** Open Graph and Twitter meta entries emitted by the layout. */
		meta: Array<{ property: string; content: string }>;
		post: {
			title: string;
			/** The body as a parsed document; `null` when the post carries no source. */
			document: Markdown.Document | null;
			slug: string;
			typePath: "articles" | "tutorials";
			/** Small label shown above the title to identify post kind. */
			eyebrow: string;
			/** Raw DB publish timestamp where `null` means already published. */
			publishedAt: string | null;
			/** Absolute permalink, the entry's `u-url`, independent of any external canonical. */
			url: string;
			/**
			 * When the post went public: its publish date, else its creation date for a post
			 * published on save; `null` only when neither timestamp parses.
			 */
			published: Date | null;
			/** `published` as the short English date shown under the title. */
			publishedLabel: string;
			format: "html" | "md" | undefined;
			/** Tutorial tags, or an empty list for article posts. */
			tags: Array<string>;
		};
		/** Markdown string used by feed/alternate format responders. */
		markdownBody: string;
		/** Approved Webmentions, split into written responses and one-click reactions. */
		mentions: {
			/** Replies and plain mentions, oldest first, each rendered with its content. */
			responses: Array<Mention>;
			/** Likes, reposts and bookmarks, rendered as a row of authors. */
			reactions: Array<Mention>;
		};
	}

	/** One approved Webmention as the post page renders it. */
	export interface Mention {
		kind: "reply" | "like" | "repost" | "bookmark" | "mention";
		/** The response's own permalink, where its author published it. */
		url: string;
		/** The author's name, else the source's host, so every mention names someone. */
		authorName: string;
		authorUrl: string | null;
		authorPhoto: string | null;
		/** Content already sanitized when the mention was verified; `null` for a bare link. */
		contentHtml: string | null;
		publishedLabel: string;
	}

	/**
	 * Repository payload expected when resolving an article post.
	 *
	 * Uses DB-facing field names (`published_at`, `canonical_url`) so the
	 * transformation step can preserve data origin before normalization.
	 */
	export interface ArticlePost {
		postType: "articles";
		post: {
			meta: {
				title: string;
				slug: string;
				excerpt?: string;
				/** Optional external canonical URL for syndicated content. */
				canonical_url?: string;
				/** Raw markdown content persisted in storage. */
				content: string;
			};
			/** Publish timestamp in DB format; `null` means published. */
			published_at: string | null;
			created_at: string;
		};
	}

	/**
	 * Repository payload expected when resolving a tutorial post.
	 *
	 * Tutorials canonicalize to their own public URL, and may carry technology
	 * tags rendered in both the page body and structured metadata.
	 */
	export interface TutorialPost {
		postType: "tutorials";
		post: {
			meta: {
				title: string;
				slug: string;
				excerpt?: string;
				/** Raw markdown content persisted in storage. */
				content: string;
			};
			/** Publish timestamp in DB format; `null` means published. */
			published_at: string | null;
			created_at: string;
		};
		/** Tutorial tags shown as "Used" technologies in rendered markdown body. */
		tags: Array<string>;
	}

	/**
	 * Supported loaded-post variants for public post routes.
	 *
	 * This discriminated union guarantees that mapping logic only handles the two
	 * public post families (`articles` and `tutorials`).
	 */
	export type LoadedPost = ArticlePost | TutorialPost;
}

/** The kinds a stored mention can carry; anything else reads as a plain mention. */
const MENTION_KINDS = ["reply", "like", "repost", "bookmark", "mention"] as const;

/**
 * Maps repository post payloads into the post page view contract.
 *
 * This mapper centralizes post-type branching, canonical URL selection, and
 * markdown parsing so controllers can stay focused on request handling.
 */
export class PostViewModel {
	/**
	 * Builds the normalized page payload for article and tutorial routes.
	 *
	 * Articles may override canonical URLs via `canonical_url`; tutorials always
	 * use the request-derived public URL as canonical.
	 *
	 * @param loadedPost Loaded post payload from the repository layer.
	 * @param requestUrl Absolute request URL used to build canonical URLs.
	 * @param format Optional content format requested for the response.
	 * @param mentions The post's approved Webmentions.
	 * @returns A page view model ready for rendering.
	 */
	static page(
		loadedPost: PostViewModel.LoadedPost,
		requestUrl: string,
		format: "html" | "md" | undefined,
		mentions: Array<Webmention.Row> = [],
	): PostViewModel.Page {
		if (loadedPost.postType === "articles") {
			let post = loadedPost.post;
			let title = post.meta.title;
			let slug = post.meta.slug;
			let excerpt = post.meta.excerpt ?? "";
			let postUrl = new URL(`/articles/${slug}`, requestUrl).toString();
			let canonical = post.meta.canonical_url || postUrl;
			let document = this.parseBody(post.meta.content || "", "Failed to parse article content");

			return {
				title,
				description: excerpt || `Article: ${title}`,
				activePath: `/${loadedPost.postType}`,
				canonical,
				meta: [
					{ property: "og:title", content: title },
					{ property: "og:type", content: "article" },
					{ property: "og:url", content: postUrl },
					{ property: "og:site_name", content: "Sergio Xalambrí" },
					{ property: "twitter:card", content: "summary" },
					{ property: "twitter:creator", content: "@sergiodxa" },
					{ property: "twitter:site", content: "@sergiodxa" },
					{ property: "twitter:title", content: title },
				],
				post: {
					title,
					document,
					slug,
					typePath: loadedPost.postType,
					eyebrow: "Article",
					publishedAt: post.published_at,
					...this.publication(post, postUrl),
					format,
					tags: [],
				},
				markdownBody: `# ${title}\n\n${post.meta.content}\n\n`,
				mentions: this.mentions(mentions),
			};
		}

		let post = loadedPost.post;
		let title = post.meta.title;
		let slug = post.meta.slug;
		let excerpt = post.meta.excerpt ?? "";
		let postUrl = new URL(`/tutorials/${slug}`, requestUrl).toString();
		let document = this.parseBody(post.meta.content || "", "Failed to parse tutorial content");

		return {
			title,
			description: excerpt || `Tutorial: ${title}`,
			activePath: `/${loadedPost.postType}`,
			canonical: postUrl,
			meta: [
				{ property: "og:title", content: title },
				{ property: "og:type", content: "article" },
				{ property: "og:url", content: postUrl },
				{ property: "og:site_name", content: "Sergio Xalambrí" },
				{ property: "twitter:card", content: "summary" },
				{ property: "twitter:creator", content: "@sergiodxa" },
				{ property: "twitter:site", content: "@sergiodxa" },
				{ property: "twitter:title", content: title },
			],
			post: {
				title,
				document,
				slug,
				typePath: loadedPost.postType,
				eyebrow: "Tutorial",
				publishedAt: post.published_at,
				...this.publication(post, postUrl),
				format,
				tags: loadedPost.tags,
			},
			markdownBody: `# ${title}\n\nUsed: ${loadedPost.tags.join(" - ")}\n\n${post.meta.content}\n\n`,
			mentions: this.mentions(mentions),
		};
	}

	/**
	 * Splits stored mentions into responses and reactions and fills in what the page
	 * shows for each, keeping the stored order.
	 *
	 * @param rows Approved mention rows.
	 */
	private static mentions(rows: Array<Webmention.Row>): PostViewModel.Page["mentions"] {
		let responses: Array<PostViewModel.Mention> = [];
		let reactions: Array<PostViewModel.Mention> = [];

		for (let row of rows) {
			let published = row.published_at ? parseDate(row.published_at) : null;
			let mention: PostViewModel.Mention = {
				kind: MENTION_KINDS.find((kind) => kind === row.kind) ?? "mention",
				url: row.url,
				authorName: row.author_name || hostOf(row.source),
				authorUrl: row.author_url,
				authorPhoto: row.author_photo,
				contentHtml: row.content_html,
				publishedLabel:
					published && isSuccess(published)
						? formatDate(published.data, { locale: "en", timeZone: "UTC" })
						: "",
			};

			if (row.kind === "reply" || row.kind === "mention") responses.push(mention);
			else reactions.push(mention);
		}

		return { responses, reactions };
	}

	/**
	 * The permalink and publication date the page marks up as its `h-entry`, so a
	 * parser reading the page finds the same instant the feed lists it under.
	 *
	 * @param post Stored timestamps of the post.
	 * @param url The post's absolute permalink.
	 */
	private static publication(
		post: { published_at: string | null; created_at: string },
		url: string,
	): { url: string; published: Date | null; publishedLabel: string } {
		let timestamp = Post.timestampFromPublishedOrCreated(post);
		if (Number.isNaN(timestamp)) return { url, published: null, publishedLabel: "" };

		let published = new Date(timestamp);
		let publishedLabel = formatDate(published, {
			locale: "en",
			timeZone: "UTC",
			dateStyle: "long",
		});
		return { url, published, publishedLabel };
	}

	/**
	 * Parses a post body into a document whose fences carry the tokens they render
	 * with. A source the parser stops on throws through `succeeded(...)`, so a page
	 * is built from a document that parsed whole or from none at all.
	 *
	 * @param content Raw markdown text from persisted post metadata.
	 * @param message Failure message used when the source will not parse.
	 * @returns The parsed document, or `null` when the post carries no source.
	 */
	private static parseBody(content: string, message: string): Markdown.Document | null {
		if (!content.trim()) return null;

		let parsed = Markdown.parse(content);
		succeeded(parsed, message);

		let highlighted = Markdown.walk(parsed.data.document, highlight);
		succeeded(highlighted, message);

		return highlighted.data;
	}
}
