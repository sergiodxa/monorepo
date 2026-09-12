/**
 * View model for public post pages. It maps article and tutorial payloads into the one
 * page contract the post route renders, so post-type branching, canonical URL selection,
 * meta generation, and markdown parsing stay out of the controller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { succeeded } from "@sdxc/result";

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
			format: "html" | "md" | undefined;
			/** Tutorial tags, or an empty list for article posts. */
			tags: Array<string>;
		};
		/** Markdown string used by feed/alternate format responders. */
		markdownBody: string;
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
	 * @returns A page view model ready for rendering.
	 */
	static page(
		loadedPost: PostViewModel.LoadedPost,
		requestUrl: string,
		format: "html" | "md" | undefined,
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
					format,
					tags: [],
				},
				markdownBody: `# ${title}\n\n${post.meta.content}\n\n`,
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
				format,
				tags: loadedPost.tags,
			},
			markdownBody: `# ${title}\n\nUsed: ${loadedPost.tags.join(" - ")}\n\n${post.meta.content}\n\n`,
		};
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
