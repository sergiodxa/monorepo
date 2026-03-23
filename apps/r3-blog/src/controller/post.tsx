import { notFound, ok } from "@pkg/http/response/html";
import { Markdown } from "@pkg/markdown/server";
import action from "@pkg/remix-helpers/action";
import { isFailure } from "@pkg/result";
import { renderToString } from "remix/component/server";
import * as s from "remix/data-schema";

import type routes from "~/routes";

import { PostPage } from "~/components/pages";
import { metaPath, metaTitle } from "~/lib/post-meta-view";
import { db } from "~/middleware/db";
import { ArticlePost } from "~/models/posts/article";
import { GlossaryPost } from "~/models/posts/glossary";
import { TutorialPost } from "~/models/posts/tutorial";

let markdown = new Markdown({ frontmatter: s.object({}) });

export default action<typeof routes.post>(async (ctx) => {
	let postType = ctx.params.postType;
	let postSlug = ctx.params.postSlug;
	if (!postType || !postSlug) return notFound("<h1>404 Not Found</h1>");
	let database = db(ctx);

	let title = "";
	let content = "";
	let typePath = postType;
	let eyebrow = "";
	let slug = postSlug;
	let publishedAt: string | null | undefined;
	let tags: Array<string> = [];
	let related: Array<{ href: string; label: string; reason: string }> = [];

	if (postType === "articles") {
		let post = await ArticlePost.findBySlug(database, postSlug);
		if (!post) return notFound("<h1>404 Not Found</h1>");

		title = metaTitle(post.meta, `Article ${post.post.id}`);
		content = post.meta.content || "";
		eyebrow = "Article";
		slug = post.meta.slug || postSlug;
		publishedAt = post.post.published_at;
	} else if (postType === "tutorials") {
		let post = await TutorialPost.findBySlug(database, postSlug);
		if (!post) return notFound("<h1>404 Not Found</h1>");

		title = metaTitle(post.meta, `Tutorial ${post.post.id}`);
		content = post.meta.content || "";
		eyebrow = "Tutorial";
		slug = post.meta.slug || postSlug;
		publishedAt = post.post.published_at;
		if (Array.isArray(post.meta.tags)) tags = post.meta.tags;
		if (typeof post.meta.tags === "string") tags = [post.meta.tags];

		if (tags.length > 0) {
			let tutorials = await TutorialPost.findAll(database);
			let currentId = post.post.id;
			let ranked = tutorials
				.filter((item) => item.post.id !== currentId)
				.map((item) => {
					let tutorialTags: Array<string> = [];
					if (Array.isArray(item.meta.tags)) tutorialTags = item.meta.tags;
					if (typeof item.meta.tags === "string") tutorialTags = [item.meta.tags];

					let match = tutorialTags.find((tag) => tags.includes(tag));
					return {
						href: metaPath(item.meta, "/tutorials"),
						label: metaTitle(item.meta, `Tutorial ${item.post.id}`),
						reason: match ? `Because both uses ${match}` : "",
						hasMatch: Boolean(match),
					};
				})
				.filter((item) => item.hasMatch)
				.slice(0, 3)
				.map((item) => ({ href: item.href, label: item.label, reason: item.reason }));

			related = ranked;
		}
	} else if (postType === "glossary") {
		let post = await GlossaryPost.findBySlug(database, postSlug);
		if (!post) return notFound("<h1>404 Not Found</h1>");

		title = post.meta.title ?? post.meta.term;
		content = post.meta.definition || "";
		eyebrow = "Glossary";
		slug = post.meta.slug || postSlug;
		publishedAt = post.post.published_at;
	} else {
		return notFound("<h1>404 Not Found</h1>");
	}

	let body = await renderToString(
		<PostPage
			title={title}
			content={(() => {
				let result = markdown.parse(content);
				if (isFailure(result)) return null;
				return result.data.content;
			})()}
			slug={slug}
			typePath={typePath}
			eyebrow={eyebrow}
			publishedAt={publishedAt}
			format={ctx.params.ext}
			tags={tags}
			related={related}
		/>,
	);

	return ok(body);
});
