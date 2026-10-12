/**
 * View model for public post pages. It maps every served kind's payload into the one
 * page contract the post route renders, so post-type branching, canonical URL selection,
 * meta generation, and markdown parsing stay out of the controller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatDate, parseDate } from "@sdxc/dates";
import { createDiagramVisitor } from "@sdxc/diagram/markdown";
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { isSuccess, succeeded } from "@sdxc/result";

import type { PublicTypePath } from "~/app/models/kinds";
import type { Webmention } from "~/app/models/webmentions";

import { POST_KINDS } from "~/app/models/kinds";
import { noteTitle, timestampFromPublishedOrCreated } from "~/app/models/post-values";
import { hostOf } from "~/app/models/webmentions";
import { permalink } from "~/app/services/webmention";

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
		/**
		 * Where each tag links, by tag: the topic listing exactly that tag, else a search for
		 * it. A tag missing here links to the search.
		 */
		tagHrefs?: Record<string, string>;
		/** Preferred URL for indexing; may differ from the request URL. */
		canonical: string;
		/** The post's ActivityStreams id, its permalink on the canonical origin. */
		activity: string;
		/** Open Graph and Twitter meta entries emitted by the layout. */
		meta: Array<{ property: string; content: string }>;
		post: {
			/** What the page heads with; a note's stand-in from its content, which no heading shows. */
			title: string;
			/** Whether the post has a title of its own to head the page with; a note has none. */
			titled: boolean;
			/** The body as a parsed document; `null` when the post carries no source. */
			document: Markdown.Document | null;
			slug: string;
			typePath: PublicTypePath;
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
			/** Tutorial and TIL tags, or an empty list for other posts. */
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

	/** A note as the repository loads it: Markdown content and its base-36 slug, no title. */
	export interface NotePost {
		postType: "notes";
		post: {
			meta: { slug: string; content: string };
			/** Publish timestamp in DB format; `null` means published. */
			published_at: string | null;
			created_at: string;
		};
	}

	/** A TIL as the repository loads it: a title heading its Markdown content, and tags. */
	export interface TilPost {
		postType: "til";
		post: {
			meta: { title: string; slug: string; content: string };
			/** Publish timestamp in DB format; `null` means published. */
			published_at: string | null;
			created_at: string;
		};
		tags: Array<string>;
	}

	/** A weekly releases post: a title heading the Markdown list of the week's packages. */
	export interface ReleasePost {
		postType: "releases";
		post: {
			meta: { title: string; slug: string; content: string };
			/** Publish timestamp in DB format; `null` means published. */
			published_at: string | null;
			created_at: string;
		};
	}

	/** Every kind the public post page serves, each mapped by its own branch. */
	export type LoadedPost = ArticlePost | TutorialPost | NotePost | TilPost | ReleasePost;
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
		mentions: Array<Webmention> = [],
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
				activity: permalink({ postType: loadedPost.postType, slug }).href,
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
					titled: true,
					document,
					slug,
					typePath: loadedPost.postType,
					eyebrow: POST_KINDS.article.label,
					publishedAt: post.published_at,
					...this.publication(post, postUrl),
					format,
					tags: [],
				},
				markdownBody: `# ${title}\n\n${post.meta.content}\n\n`,
				mentions: this.mentions(mentions),
			};
		}

		if (loadedPost.postType === "notes" || loadedPost.postType === "til") {
			return this.short(loadedPost, requestUrl, format, mentions);
		}

		if (loadedPost.postType === "releases") {
			return this.release(loadedPost, requestUrl, format, mentions);
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
			activity: permalink({ postType: loadedPost.postType, slug }).href,
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
				titled: true,
				document,
				slug,
				typePath: loadedPost.postType,
				eyebrow: POST_KINDS.tutorial.label,
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
	 * The page of a note or a TIL, both short and canonical at their own permalink. A note is
	 * named by its content shortened, which heads nothing on the page; a TIL heads with its title.
	 *
	 * @param loadedPost The note or TIL.
	 * @param requestUrl Absolute request URL used to build the permalink.
	 * @param format Optional content format requested for the response.
	 * @param mentions The post's approved Webmentions.
	 */
	private static short(
		loadedPost: PostViewModel.NotePost | PostViewModel.TilPost,
		requestUrl: string,
		format: "html" | "md" | undefined,
		mentions: Array<Webmention>,
	): PostViewModel.Page {
		let post = loadedPost.post;
		let slug = post.meta.slug;
		let titled = loadedPost.postType === "til";
		let title =
			loadedPost.postType === "til" ? loadedPost.post.meta.title : noteTitle(post.meta.content);
		let kind = POST_KINDS[loadedPost.postType === "til" ? "til" : "note"];
		let tags = loadedPost.postType === "til" ? loadedPost.tags : [];
		let postUrl = new URL(`/${loadedPost.postType}/${slug}`, requestUrl).toString();
		let document = this.parseBody(post.meta.content || "", `Failed to parse ${kind.label} content`);

		return {
			title,
			description: titled ? `${kind.label}: ${title}` : title,
			activePath: `/${loadedPost.postType}`,
			canonical: postUrl,
			activity: permalink({ postType: loadedPost.postType, slug }).href,
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
				titled,
				document,
				slug,
				typePath: loadedPost.postType,
				eyebrow: kind.label,
				publishedAt: post.published_at,
				...this.publication(post, postUrl),
				format,
				tags,
			},
			markdownBody: titled ? `# ${title}\n\n${post.meta.content}\n\n` : `${post.meta.content}\n\n`,
			mentions: this.mentions(mentions),
		};
	}

	/**
	 * The page of a weekly releases post, canonical at its own permalink and described by the
	 * week it covers, since its title is the same every week.
	 *
	 * @param loadedPost The releases post.
	 * @param requestUrl Absolute request URL used to build the permalink.
	 * @param format Optional content format requested for the response.
	 * @param mentions The post's approved Webmentions.
	 */
	private static release(
		loadedPost: PostViewModel.ReleasePost,
		requestUrl: string,
		format: "html" | "md" | undefined,
		mentions: Array<Webmention>,
	): PostViewModel.Page {
		let post = loadedPost.post;
		let { title, slug } = post.meta;
		let postUrl = new URL(`/${loadedPost.postType}/${slug}`, requestUrl).toString();
		let document = this.parseBody(post.meta.content || "", "Failed to parse release content");

		return {
			title,
			description: `The packages I released in ${slug.toUpperCase()}.`,
			activePath: `/${loadedPost.postType}`,
			canonical: postUrl,
			activity: permalink({ postType: loadedPost.postType, slug }).href,
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
				titled: true,
				document,
				slug,
				typePath: loadedPost.postType,
				eyebrow: POST_KINDS.release.label,
				publishedAt: post.published_at,
				...this.publication(post, postUrl),
				format,
				tags: [],
			},
			markdownBody: `# ${title}\n\n${post.meta.content}\n\n`,
			mentions: this.mentions(mentions),
		};
	}

	/**
	 * Splits stored mentions into responses and reactions and fills in what the page
	 * shows for each, keeping the stored order.
	 *
	 * @param rows Approved mention rows.
	 */
	private static mentions(rows: Array<Webmention>): PostViewModel.Page["mentions"] {
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
		let timestamp = timestampFromPublishedOrCreated(post);
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
	 * Parses a post body into a document whose ```mermaid fences are diagram tags and
	 * whose other fences carry the tokens they render with. A source the parser stops on
	 * throws through `succeeded(...)`; a diagram that does not parse stays a code block.
	 *
	 * @param content Raw markdown text from persisted post metadata.
	 * @param message Failure message used when the source will not parse.
	 * @returns The parsed document, or `null` when the post carries no source.
	 */
	private static parseBody(content: string, message: string): Markdown.Document | null {
		if (!content.trim()) return null;

		let parsed = Markdown.parse(content);
		succeeded(parsed, message);

		let highlighted = Markdown.walk(
			parsed.data.document,
			Markdown.compose(createDiagramVisitor({ invalid: "keep" }), highlight),
		);
		succeeded(highlighted, message);

		return highlighted.data;
	}
}
