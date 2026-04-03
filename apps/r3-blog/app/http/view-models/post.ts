import type { Markdown as MarkdownType } from "@pkg/markdown/server";

import { Markdown } from "@pkg/markdown/server";
import { succeeded } from "@pkg/result";
import * as s from "remix/data-schema";

import type { ContentTypeParam } from "~/app/http/responses/format";

let markdown = new Markdown({ frontmatter: s.object({}) });

export namespace PostViewModel {
	export interface Page {
		title: string;
		description: string;
		activePath: string;
		canonical: string;
		meta: Array<{ property: string; content: string }>;
		post: {
			title: string;
			content: MarkdownType.AST | null;
			slug: string;
			typePath: "articles" | "tutorials";
			eyebrow: string;
			publishedAt: string | null;
			format: ContentTypeParam | undefined;
			tags: Array<string>;
		};
		markdownBody: string;
	}

	export type LoadedPost =
		| {
				postType: "articles";
				post: {
					meta: {
						title: string;
						slug: string;
						excerpt?: string;
						canonical_url?: string;
						content: string;
					};
					published_at: string | null;
				};
		  }
		| {
				postType: "tutorials";
				post: {
					meta: {
						title: string;
						slug: string;
						excerpt?: string;
						content: string;
					};
					published_at: string | null;
				};
				tags: Array<string>;
		  };
}

export class PostViewModel {
	static page(
		loadedPost: PostViewModel.LoadedPost,
		requestUrl: string,
		format: ContentTypeParam | undefined,
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

	private static parseMarkdownContent(content: string, message: string): MarkdownType.AST | null {
		let parsed = markdown.parse(content || "");
		succeeded(parsed, message);
		return parsed.data.content;
	}
}
