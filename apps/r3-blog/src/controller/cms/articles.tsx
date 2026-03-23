import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSActionPage, CMSResourcePage } from "~/components/cms-pages";
import { metaPath, metaTitle } from "~/lib/post-meta-view";
import { db } from "~/middleware/db";
import { ArticlePost } from "~/models/posts/article";

function render(title: string, activePath: string, description: string) {
	return renderToString(
		<CMSActionPage title={title} activePath={activePath} description={description} />,
	);
}

export default controller<typeof routes.cms.articles>({
	middleware: [],

	actions: {
		async index(ctx) {
			let articles = await ArticlePost.findAll(db(ctx));
			let items = articles.map((article) => {
				let title = metaTitle(article.meta, `Article ${article.post.id}`);
				let path = metaPath(article.meta, "/articles");
				return {
					label: `${title} (${path})`,
					href: `/cms/articles/${article.post.id}`,
				};
			});

			let body = await renderToString(
				<CMSResourcePage
					title="Articles"
					activePath="/cms/articles"
					searchLabel="What're you looking for?"
					searchCta="Search"
					primaryCta={{ href: "/cms/articles/new", label: "New Article" }}
					items={items}
					emptyLabel="No articles found in the database yet."
				/>,
			);
			return ok(body);
		},

		async create(ctx) {
			let total = (await ArticlePost.findAll(db(ctx))).length;
			let body = await render(
				"Create Article",
				"/cms/articles",
				`Create Article. There are currently ${total} articles in the database.`,
			);
			return ok(body);
		},

		async destroy(ctx) {
			let article = await ArticlePost.findById(db(ctx), ctx.params.id);
			if (!article) {
				let body = await render(
					"Article Not Found",
					"/cms/articles",
					`Article ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let title = metaTitle(article.meta, article.post.id);
			let body = await render(
				`Delete Article ${title}`,
				"/cms/articles",
				`Ready to delete article "${title}" (${article.post.id}).`,
			);
			return ok(body);
		},

		async edit(ctx) {
			let article = await ArticlePost.findById(db(ctx), ctx.params.id);
			if (!article) {
				let body = await render(
					"Article Not Found",
					"/cms/articles",
					`Article ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let title = metaTitle(article.meta, article.post.id);
			let body = await render(
				`Edit Article ${title}`,
				"/cms/articles",
				`Editing article "${title}" at ${metaPath(article.meta, "/articles")}.`,
			);
			return ok(body);
		},

		async new(ctx) {
			let total = (await ArticlePost.findAll(db(ctx))).length;
			let body = await render(
				"New Article",
				"/cms/articles",
				`New Article form loaded. Current articles count: ${total}.`,
			);
			return ok(body);
		},

		async show(ctx) {
			let article = await ArticlePost.findById(db(ctx), ctx.params.id);
			if (!article) {
				let body = await render(
					"Article Not Found",
					"/cms/articles",
					`Article ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let body = await render(
				metaTitle(article.meta, `Article ${article.post.id}`),
				"/cms/articles",
				`Article ${article.post.id} lives at ${metaPath(article.meta, "/articles")}.`,
			);
			return ok(body);
		},

		async update(ctx) {
			let article = await ArticlePost.findById(db(ctx), ctx.params.id);
			if (!article) {
				let body = await render(
					"Article Not Found",
					"/cms/articles",
					`Article ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let title = metaTitle(article.meta, article.post.id);
			let body = await render(
				`Update Article ${title}`,
				"/cms/articles",
				`Update flow loaded for article "${title}" (${article.post.id}).`,
			);
			return ok(body);
		},
	},
});
