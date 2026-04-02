import type { Markdown as MarkdownType } from "@pkg/markdown/server";

import { Markdown } from "@pkg/markdown/server";
import { succeeded } from "@pkg/result";
import * as s from "remix/data-schema";

import type { TutorialPost } from "~/app/repositories/posts/tutorial";

import type { LoadedPostByType } from "./load";
import type { ContentTypeParam, PostType } from "./request";

export interface PostPageViewModel {
	title: string;
	description: string;
	activePath: string;
	canonical: string;
	meta: Array<{ property: string; content: string }>;
	post: {
		title: string;
		content: MarkdownType.AST | null;
		slug: string;
		typePath: PostType;
		eyebrow: string;
		publishedAt: string | null;
		format: ContentTypeParam | undefined;
		tags: Array<string>;
		related: Array<TutorialPost.RelatedItem>;
	};
	markdownBody: string;
}

const markdown = new Markdown({ frontmatter: s.object({}) });

function parseMarkdownContent(content: string, message: string): MarkdownType.AST | null {
	let parsed = markdown.parse(content || "");
	succeeded(parsed, message);
	return parsed.data.content;
}

export function createPostPageViewModel(
	loadedPost: LoadedPostByType,
	requestUrl: string,
	format: ContentTypeParam | undefined,
): PostPageViewModel {
	if (loadedPost.postType === "articles") {
		let post = loadedPost.post;
		let title = post.meta.title;
		let slug = post.meta.slug;
		let excerpt = post.meta.excerpt ?? "";
		let postUrl = new URL(`/articles/${slug}`, requestUrl).toString();
		let canonical = post.meta.canonical_url || postUrl;
		let content = parseMarkdownContent(post.meta.content || "", "Failed to parse article content");

		return {
			title,
			description: excerpt || `Article: ${title}`,
			activePath: `/${loadedPost.postType}`,
			canonical,
			meta: [
				{ property: "og:title", content: title },
				{ property: "og:type", content: "article" },
				{ property: "og:url", content: postUrl },
				{ property: "og:site_name", content: "Sergio Xalambr\u00ed" },
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
				related: [],
			},
			markdownBody: `# ${title}\n\n${post.meta.content}\n\n`,
		};
	}

	let post = loadedPost.post;
	let title = post.meta.title;
	let slug = post.meta.slug;
	let excerpt = post.meta.excerpt ?? "";
	let postUrl = new URL(`/tutorials/${slug}`, requestUrl).toString();
	let content = parseMarkdownContent(post.meta.content || "", "Failed to parse tutorial content");

	return {
		title,
		description: excerpt || `Tutorial: ${title}`,
		activePath: `/${loadedPost.postType}`,
		canonical: postUrl,
		meta: [
			{ property: "og:title", content: title },
			{ property: "og:type", content: "article" },
			{ property: "og:url", content: postUrl },
			{ property: "og:site_name", content: "Sergio Xalambr\u00ed" },
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
			related: loadedPost.related,
		},
		markdownBody: `# ${title}\n\nUsed: ${loadedPost.tags.join(" - ")}\n\n${post.meta.content}\n\n`,
	};
}
