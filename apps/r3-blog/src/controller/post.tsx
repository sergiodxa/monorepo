import { notFound, ok } from "@pkg/http/response/html";
import { Markdown } from "@pkg/markdown/server";
import action from "@pkg/remix-helpers/action";
import { isFailure } from "@pkg/result";
import { renderToString } from "remix/component/server";
import * as s from "remix/data-schema";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { db } from "~/middleware/db";
import { ArticlePost } from "~/models/posts/article";
import { TutorialPost } from "~/models/posts/tutorial";
import prismStyles from "~/styles/prism.css?url";
import { PostView } from "~/views/post";

const markdown = new Markdown({ frontmatter: s.object({}) });

interface RelatedPost {
	href: string;
	label: string;
	reason: string;
}

function parseContent(content: string) {
	let result = markdown.parse(content);
	if (isFailure(result)) return null;
	return result.data.content;
}

function parseTags(tags: unknown): Array<string> {
	if (Array.isArray(tags)) return tags.filter((tag): tag is string => typeof tag === "string");
	if (typeof tags === "string") return [tags];
	return [];
}

export default action<typeof routes.post>(async (ctx) => {
	let postType = ctx.params.postType;
	let postSlug = ctx.params.postSlug;
	if (!postType || !postSlug) return notFound("<h1>404 Not Found</h1>");
	if (postType !== "articles" && postType !== "tutorials")
		return notFound("<h1>404 Not Found</h1>");

	let database = db(ctx);

	if (postType === "articles") {
		let post = await ArticlePost.findBySlug(database, postSlug);
		if (!post) return notFound("<h1>404 Not Found</h1>");

		let title = post.meta.title;
		let content = post.meta.content || "";
		let slug = post.meta.slug;
		let body = await renderToString(
			<BlogLayout
				title={title}
				description={`${postType} / ${slug}`}
				activePath={`/${postType}`}
				stylesheets={[{ href: prismStyles }]}
			>
				<PostView
					title={title}
					content={parseContent(content)}
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
		if (!post) return notFound("<h1>404 Not Found</h1>");

		let title = post.meta.title;
		let content = post.meta.content || "";
		let slug = post.meta.slug;
		let tags = parseTags(post.meta.tags);
		let related: Array<RelatedPost> = [];

		if (tags.length > 0) {
			let tutorials = await TutorialPost.findAll(database);
			let currentId = post.post.id;
			let ranked = tutorials
				.filter((item) => item.post.id !== currentId)
				.map((item) => {
					let tutorialTags = parseTags(item.meta.tags);

					let match = tutorialTags.find((tag) => tags.includes(tag));
					return {
						href: `/tutorials/${item.meta.slug}`,
						label: item.meta.title,
						reason: match ? `Because both uses ${match}` : "",
						hasMatch: Boolean(match),
					};
				})
				.filter((item) => item.hasMatch)
				.slice(0, 3)
				.map((item) => ({ href: item.href, label: item.label, reason: item.reason }));

			related = ranked;
		}

		let body = await renderToString(
			<BlogLayout
				title={title}
				description={`${postType} / ${slug}`}
				activePath={`/${postType}`}
				stylesheets={[{ href: prismStyles }]}
			>
				<PostView
					title={title}
					content={parseContent(content)}
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

	return notFound("<h1>404 Not Found</h1>");
});
