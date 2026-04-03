import { redirect } from "@pkg/http/response";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";

import { getAuthUser } from "~/app/http/middleware/auth";
import { db } from "~/app/http/middleware/db";
import { ArticleViewModel } from "~/app/http/view-models/cms/articles";
import { view } from "~/app/infrastructure/view";
import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { ArticleSchema } from "~/app/schemas/cms/article";
import { CMSArticlesActionView, CMSArticlesIndexView } from "~/resources/views/cms/articles";
import routes from "~/routes/web";

export default controller<typeof routes.cms.articles>({
	middleware: [],

	actions: {
		async index() {
			let articles = await ArticlePost.findAll(db());
			let sources: Array<ArticleViewModel.SourceIndexItem> = articles.map((article) => ({
				id: article.id,
				title: article.meta.title,
				slug: article.meta.slug,
				preview: !Post.isPublishedAt(article.published_at),
			}));
			let items = ArticleViewModel.index({ items: sources });

			return view(CMSArticlesIndexView, { items });
		},

		async create(ctx) {
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), ArticleSchema);
			succeeded(result, "Invalid article form data");
			let input = ArticleViewModel.input({ data: result.data });

			let created = await ArticlePost.create(db(), {
				author_id: user.id,
				published_at: input.published_at,
				meta: input.meta,
			});

			if (!created)
				return redirect(routes.cms.articles.index.href(), { status: redirect.Status.SeeOther });

			return redirect(routes.cms.articles.edit.href({ id: created.id }), {
				status: redirect.Status.SeeOther,
			});
		},

		async destroy(ctx) {
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.articles.index.href(), { status: redirect.Status.SeeOther });

			await ArticlePost.destroy(db(), id);
			return redirect(routes.cms.articles.index.href(), { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let id = ctx.params.id;
			let article = id ? await ArticlePost.findById(db(), id) : null;

			if (!article) {
				let viewProps = ArticleViewModel.notFound({ id });
				return view(CMSArticlesActionView, viewProps, { status: 404 });
			}

			let source: ArticleViewModel.SourceEditItem = {
				id: article.id,
				title: article.meta.title,
				slug: article.meta.slug,
				locale: article.meta.locale,
				excerpt: article.meta.excerpt,
				canonical_url: article.meta.canonical_url,
				content: article.meta.content,
				published_at: article.published_at,
			};
			let viewProps = ArticleViewModel.edit({ article: source });

			return view(CMSArticlesActionView, viewProps);
		},

		async new() {
			let viewProps = ArticleViewModel.new({});

			return view(CMSArticlesActionView, viewProps);
		},

		async update(ctx) {
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(routes.cms.articles.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), ArticleSchema);
			succeeded(result, "Invalid article form data");
			let input = ArticleViewModel.input({ data: result.data });

			let updated = await ArticlePost.update(db(), id, {
				author_id: user.id,
				published_at: input.published_at,
				meta: input.meta,
			});

			if (!updated) {
				let viewProps = ArticleViewModel.notFound({ id });
				return view(CMSArticlesActionView, viewProps, { status: 404 });
			}

			return redirect(routes.cms.articles.edit.href({ id }), { status: redirect.Status.SeeOther });
		},
	},
});
