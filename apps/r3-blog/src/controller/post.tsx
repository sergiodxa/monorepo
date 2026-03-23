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
import { NotFoundView } from "~/views/not-found";
import { PostView } from "~/views/post";

const markdown = new Markdown({ frontmatter: s.object({}) });

function parseContent(content: string) {
	let result = markdown.parse(content);
	if (isFailure(result)) return null;
	return result.data.content;
}

export default action<typeof routes.post>(async (ctx) => {
	let postType = ctx.params.postType;
	let postSlug = ctx.params.postSlug;
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

	if (postType !== "articles" && postType !== "tutorials") {
		let title = "Unknown Content Type";
		let description = "Only articles and tutorials are available in this section.";
		let body = await renderToString(
			<BlogLayout title={title} description={description}>
				<NotFoundView title={title} description={description} emoji="🧩" />
			</BlogLayout>,
		);

		return notFound(body);
	}

	let database = db(ctx);

	if (postType === "articles") {
		let post = await ArticlePost.findBySlug(database, postSlug);
		if (!post) {
			let title = "Article Not Found";
			let description = "This article does not exist or is no longer available.";
			let body = await renderToString(
				<BlogLayout title={title} description={description}>
					<NotFoundView title={title} description={description} emoji="📝" />
				</BlogLayout>,
			);

			return notFound(body);
		}

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
		if (!post) {
			let title = "Tutorial Not Found";
			let description = "This tutorial does not exist or is no longer available.";
			let body = await renderToString(
				<BlogLayout title={title} description={description}>
					<NotFoundView title={title} description={description} emoji="🛠️" />
				</BlogLayout>,
			);

			return notFound(body);
		}

		let title = post.meta.title;
		let content = post.meta.content || "";
		let slug = post.meta.slug;
		let tags = TutorialPost.tags(post.meta.tags);
		let related = await TutorialPost.findRelatedByTags(database, post.post.id, tags, 3);

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

	let title = "Page Not Found";
	let description = "The content you requested could not be found.";
	let body = await renderToString(
		<BlogLayout title={title} description={description}>
			<NotFoundView title={title} description={description} emoji="🔎" />
		</BlogLayout>,
	);

	return notFound(body);
});
