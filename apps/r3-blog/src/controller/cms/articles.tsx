import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { db } from "~/middleware/db";
import { ArticlePost } from "~/models/posts/article";
import { CMSArticlesActionView, CMSArticlesIndexView } from "~/views/cms/articles";

namespace CMSArticlesController {
	export interface IndexProps extends CMSArticlesIndexView.Props {}
	export interface ActionProps extends CMSArticlesActionView.Props {}
}

export default controller<typeof routes.cms.articles>({
	middleware: [],

	actions: {
		async index(ctx) {
			let articles = await ArticlePost.findAll(db(ctx));
			let items: CMSArticlesController.IndexProps["items"] = articles.map((article) => ({
				id: article.post.id,
				title: article.meta.title,
				slug: article.meta.slug,
			}));

			let body = await renderToString(
				<CMSLayout title="Articles" activePath="/cms/articles">
					<CMSArticlesIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(ctx) {
			let total = (await ArticlePost.findAll(db(ctx))).length;
			let viewProps: CMSArticlesController.ActionProps = {
				title: "Create Article",
				description: `Create Article. There are currently ${total} articles in the database.`,
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/articles">
					<CMSArticlesActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async destroy(ctx) {
			let article = await ArticlePost.findById(db(ctx), ctx.params.id);
			if (!article) {
				let viewProps: CMSArticlesController.ActionProps = {
					title: "Article Not Found",
					description: `Article ${ctx.params.id} was not found.`,
				};
				let body = await renderToString(
					<CMSLayout title={viewProps.title} activePath="/cms/articles">
						<CMSArticlesActionView {...viewProps} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = article.meta.title;
			let viewProps: CMSArticlesController.ActionProps = {
				title: `Delete Article ${title}`,
				description: `Ready to delete article "${title}" (${article.post.id}).`,
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/articles">
					<CMSArticlesActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async edit(ctx) {
			let article = await ArticlePost.findById(db(ctx), ctx.params.id);
			if (!article) {
				let viewProps: CMSArticlesController.ActionProps = {
					title: "Article Not Found",
					description: `Article ${ctx.params.id} was not found.`,
				};
				let body = await renderToString(
					<CMSLayout title={viewProps.title} activePath="/cms/articles">
						<CMSArticlesActionView {...viewProps} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = article.meta.title;
			let viewProps: CMSArticlesController.ActionProps = {
				title: `Edit Article ${title}`,
				description: `Editing article "${title}" at /articles/${article.meta.slug}.`,
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/articles">
					<CMSArticlesActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async new(ctx) {
			let total = (await ArticlePost.findAll(db(ctx))).length;
			let viewProps: CMSArticlesController.ActionProps = {
				title: "New Article",
				description: `New Article form loaded. Current articles count: ${total}.`,
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/articles">
					<CMSArticlesActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async show(ctx) {
			let article = await ArticlePost.findById(db(ctx), ctx.params.id);
			if (!article) {
				let viewProps: CMSArticlesController.ActionProps = {
					title: "Article Not Found",
					description: `Article ${ctx.params.id} was not found.`,
				};
				let body = await renderToString(
					<CMSLayout title={viewProps.title} activePath="/cms/articles">
						<CMSArticlesActionView {...viewProps} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let viewProps: CMSArticlesController.ActionProps = {
				title: article.meta.title,
				description: `Article ${article.post.id} lives at /articles/${article.meta.slug}.`,
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/articles">
					<CMSArticlesActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async update(ctx) {
			let article = await ArticlePost.findById(db(ctx), ctx.params.id);
			if (!article) {
				let viewProps: CMSArticlesController.ActionProps = {
					title: "Article Not Found",
					description: `Article ${ctx.params.id} was not found.`,
				};
				let body = await renderToString(
					<CMSLayout title={viewProps.title} activePath="/cms/articles">
						<CMSArticlesActionView {...viewProps} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = article.meta.title;
			let viewProps: CMSArticlesController.ActionProps = {
				title: `Update Article ${title}`,
				description: `Update flow loaded for article "${title}" (${article.post.id}).`,
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/articles">
					<CMSArticlesActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},
	},
});
