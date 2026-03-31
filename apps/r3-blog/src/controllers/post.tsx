import * as ct from "@pkg/http/content-type";
import { accepts } from "@pkg/http/negotiate";
import { notFound, ok } from "@pkg/http/response/html";
import { Markdown } from "@pkg/markdown/server";
import action from "@pkg/remix-helpers/action";
import { succeeded } from "@pkg/result";
import { renderToString } from "remix/component/server";
import * as s from "remix/data-schema";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { db } from "~/middleware/db";
import { ArticlePost } from "~/models/posts/article";
import { TutorialPost } from "~/models/posts/tutorial";
import prismStyles from "~/styles/prism.css?url";
import { NotFoundView } from "~/views/not-found";
import { PostView } from "~/views/post";

const markdown = new Markdown({ frontmatter: s.object({}) });

const SUPPORTED_POST_TYPES = new Set(["articles", "tutorials"]);
const SUPPORTED_CONTENT_TYPES = new Set(["html", "md"]);

export default action<typeof routes.post>(async (ctx) => {
	let postType = ctx.params.postType;
	let postSlug = ctx.params.postSlug;
	let contentType = ctx.params.ext;

	if (!postType || !postSlug) {
		let title = "Invalid Post URL";
		let description = "The requested post URL is invalid.";
		let body = await renderToString(
			<BlogLayout title={title} description={description}>
				<NotFoundView title={title} description={description} emoji="🧭" />
			</BlogLayout>,
		);

		return notFound(body);
	}

	if (contentType && !SUPPORTED_CONTENT_TYPES.has(contentType)) {
		let title = "Unsupported Content Type";
		let description = `The content type "${contentType}" is not supported.`;
		let body = await renderToString(
			<BlogLayout title={title} description={description}>
				<NotFoundView title={title} description={description} emoji="🚫" />
			</BlogLayout>,
		);

		return notFound(body);
	}

	let prefers = accepts(ctx.request).preferred(ct.HTML, ct.Markdown);

	if (!SUPPORTED_POST_TYPES.has(postType)) {
		let title = "Unknown Content Type";
		let description = "Only articles and tutorials are available in this section.";

		if (contentType === "md" || prefers === ct.Markdown) {
			return new Response(`# ${title}\n\n${description}\n\n`, {
				status: 400,
				headers: { "Content-Type": ct.Markdown },
			});
		}

		let body = await renderToString(
			<BlogLayout title={title} description={description}>
				<NotFoundView title={title} description={description} emoji="🧩" />
			</BlogLayout>,
		);

		return notFound(body);
	}

	let database = db();

	if (postType === "articles") {
		let post = await ArticlePost.findBySlug(database, postSlug);
		if (!post) {
			let title = "Article Not Found";
			let description = "This article does not exist or is no longer available.";

			if (contentType === "md" || prefers === ct.Markdown) {
				return new Response(`# ${title}\n\n${description}\n\n`, {
					status: 404,
					headers: { "Content-Type": ct.Markdown },
				});
			}

			let body = await renderToString(
				<BlogLayout title={title} description={description}>
					<NotFoundView title={title} description={description} emoji="📝" />
				</BlogLayout>,
			);

			return notFound(body);
		}

		let title = post.meta.title;
		let content = markdown.parse(post.meta.content || "");
		succeeded(content, "Failed to parse article content");

		let slug = post.meta.slug;
		let excerpt = post.meta.excerpt ?? "";
		let postUrl = new URL(`/articles/${slug}`, ctx.request.url).toString();
		let canonical = post.meta.canonical_url || postUrl;

		if (contentType === "md" || prefers === ct.Markdown) {
			return new Response(`# ${title}\n\n${post.meta.content}\n\n`, {
				status: 200,
				headers: { "Content-Type": ct.Markdown },
			});
		}

		let body = await renderToString(
			<BlogLayout
				title={title}
				description={excerpt || `Article: ${title}`}
				activePath={`/${postType}`}
				stylesheets={[{ href: prismStyles }]}
				canonical={canonical}
				meta={[
					{ property: "og:title", content: title },
					{ property: "og:type", content: "article" },
					{ property: "og:url", content: postUrl },
					{ property: "og:site_name", content: "Sergio Xalambrí" },
					{ property: "twitter:card", content: "summary" },
					{ property: "twitter:creator", content: "@sergiodxa" },
					{ property: "twitter:site", content: "@sergiodxa" },
					{ property: "twitter:title", content: title },
				]}
			>
				<PostView
					title={title}
					content={content.data.content}
					slug={slug}
					typePath={postType}
					eyebrow="Article"
					publishedAt={post.post.published_at}
					format={ctx.params.ext}
					tags={[]}
					related={[]}
				/>
			</BlogLayout>,
		);

		return ok(body);
	}

	if (postType === "tutorials") {
		let post = await TutorialPost.findBySlug(database, postSlug);
		if (!post) {
			let title = "Tutorial Not Found";
			let description = "This tutorial does not exist or is no longer available.";

			if (contentType === "md" || prefers === ct.Markdown) {
				return new Response(`# ${title}\n\n${description}\n\n`, {
					status: 404,
					headers: { "Content-Type": ct.Markdown },
				});
			}

			let body = await renderToString(
				<BlogLayout title={title} description={description}>
					<NotFoundView title={title} description={description} emoji="🛠️" />
				</BlogLayout>,
			);

			return notFound(body);
		}

		let title = post.meta.title;

		let content = markdown.parse(post.meta.content || "");
		succeeded(content, "Failed to parse tutorial content");

		let slug = post.meta.slug;
		let excerpt = post.meta.excerpt ?? "";
		let tags = TutorialPost.tags(post.meta.tags);
		let related = await TutorialPost.findRelatedByTags(database, post.post.id, tags, 3);
		let postUrl = new URL(`/tutorials/${slug}`, ctx.request.url).toString();

		if (contentType === "md" || prefers === ct.Markdown) {
			return new Response(`# ${title}\n\nUsed: ${tags.join(" - ")}\n\n${post.meta.content}\n\n`, {
				status: 200,
				headers: { "Content-Type": ct.Markdown },
			});
		}

		let body = await renderToString(
			<BlogLayout
				title={title}
				description={excerpt || `Tutorial: ${title}`}
				activePath={`/${postType}`}
				stylesheets={[{ href: prismStyles }]}
				canonical={postUrl}
				meta={[
					{ property: "og:title", content: title },
					{ property: "og:type", content: "article" },
					{ property: "og:url", content: postUrl },
					{ property: "og:site_name", content: "Sergio Xalambrí" },
					{ property: "twitter:card", content: "summary" },
					{ property: "twitter:creator", content: "@sergiodxa" },
					{ property: "twitter:site", content: "@sergiodxa" },
					{ property: "twitter:title", content: title },
				]}
			>
				<PostView
					title={title}
					content={content.data.content}
					slug={slug}
					typePath={postType}
					eyebrow="Tutorial"
					publishedAt={post.post.published_at}
					format={ctx.params.ext}
					tags={tags}
					related={related}
				/>
			</BlogLayout>,
		);

		return ok(body);
	}

	let title = "Page Not Found";
	let description = "The content you requested could not be found.";

	if (contentType === "md" || prefers === ct.Markdown) {
		return new Response(`# ${title}\n\n${description}\n\n`, {
			status: 404,
			headers: { "Content-Type": ct.Markdown },
		});
	}

	let body = await renderToString(
		<BlogLayout title={title} description={description}>
			<NotFoundView title={title} description={description} emoji="🔎" />
		</BlogLayout>,
	);

	return notFound(body);
});
