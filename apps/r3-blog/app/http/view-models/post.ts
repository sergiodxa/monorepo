import type { Markdown as MarkdownType } from "@pkg/markdown/server";

import { Markdown } from "@pkg/markdown/server";
import { succeeded } from "@pkg/result";
import * as s from "remix/data-schema";

/**
 * Shared markdown parser configured to accept body-only content.
 *
 * Post sources in this app do not require frontmatter keys, so the parser uses
 * an empty frontmatter schema and treats markdown body content as the contract.
 */
let markdown = new Markdown({ frontmatter: s.object({}) });

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
		/** Human-readable page title used in `<title>` and social tags. */
		title: string;
		/** Short summary used for SEO description and feed-like previews. */
		description: string;
		/** Top-level navigation path that should appear active in the UI. */
		activePath: string;
		/** Preferred URL for indexing; may differ from the request URL. */
		canonical: string;
		/** Open Graph and Twitter meta entries emitted by the layout. */
		meta: Array<{ property: string; content: string }>;
		/** Core post content displayed in the article body template. */
		post: {
			/** Display title repeated in page body and share cards. */
			title: string;
			/** Parsed markdown AST; `null` when source content is empty. */
			content: MarkdownType.AST | null;
			/** URL slug used in public route segments. */
			slug: string;
			/** Public section path supported by this app. */
			typePath: "articles" | "tutorials";
			/** Small label shown above the title to identify post kind. */
			eyebrow: string;
			/** Raw DB publish timestamp where `null` means already published. */
			publishedAt: string | null;
			/** Optional content type override requested by the response format. */
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
		/** Discriminant used to branch article-specific mapping logic. */
		postType: "articles";
		post: {
			meta: {
				/** Article heading displayed in metadata and page content. */
				title: string;
				/** Slug segment used to build `/articles/:slug` URLs. */
				slug: string;
				/** Optional summary used as SEO description when present. */
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
	 * Tutorials do not provide `canonical_url`, and may include technology tags
	 * that are rendered in both the page body and structured metadata.
	 */
	export interface TutorialPost {
		/** Discriminant used to branch tutorial-specific mapping logic. */
		postType: "tutorials";
		post: {
			meta: {
				/** Tutorial heading displayed in metadata and page content. */
				title: string;
				/** Slug segment used to build `/tutorials/:slug` URLs. */
				slug: string;
				/** Optional summary used as SEO description when present. */
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
			let content = this.parseMarkdownContent(
				post.meta.content || "",
				"Failed to parse article content",
			);

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
					content,
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
		let content = this.parseMarkdownContent(
			post.meta.content || "",
			"Failed to parse tutorial content",
		);

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
				content,
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
	 * Parses raw markdown into an AST and enforces parse success.
	 *
	 * Throws through `succeeded(...)` when parsing fails to avoid rendering a
	 * partially-initialized page model.
	 *
	 * @param content Raw markdown text from persisted post metadata.
	 * @param message Failure message used when parse result is unsuccessful.
	 * @returns Parsed markdown AST content, or `null` for empty content.
	 */
	private static parseMarkdownContent(content: string, message: string): MarkdownType.AST | null {
		let parsed = markdown.parse(content || "");
		succeeded(parsed, message);
		return parsed.data.content;
	}
}
