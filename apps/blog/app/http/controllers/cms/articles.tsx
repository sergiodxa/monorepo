/**
 * CMS controller for article CRUD. It renders index and edit/new HTML views and handles
 * create, update, and destroy actions, validating form data against the article schema and
 * using See Other redirects to preserve post/redirect/get flow. It exists to manage
 * articles from the backoffice, returning in-context 404 views for missing records.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { succeeded } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import { getAuthUser } from "~/app/http/middleware/auth";
import { ArticleViewModel } from "~/app/http/view-models/cms/articles";
import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { ArticleSchema } from "~/app/schemas/cms/article";
import { CMSArticlesActionView, CMSArticlesIndexView } from "~/resources/views/cms/articles";
import routes from "~/routes/web";

/**
 * CMS article CRUD. Read screens answer with rendered HTML while mutating actions answer
 * with See Other redirects, so a reload never repeats the write.
 */
export default createController(routes.cms.articles, {
	/**
	 * The CMS route group enforces authentication, and each action keeps its own guard so
	 * direct access or a misconfigured mount still redirects.
	 */
	middleware: [],

	actions: {
		/**
		 * Lists every article, preview included, so editors see scheduled work. The `preview`
		 * flag follows `Post.isPublishedAt`: `null` and past timestamps count as published,
		 * future timestamps as preview.
		 *
		 * @param ctx Request-scoped services used to resolve the database client.
		 * @returns SSR view response for the article listing page.
		 */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let articles = await ArticlePost.findAll(db, { includePreview: true });
			let sources: Array<ArticleViewModel.SourceIndexItem> = articles.map((article) => ({
				id: article.id,
				title: article.meta.title,
				slug: article.meta.slug,
				preview: !Post.isPublishedAt(article.published_at),
			}));
			let items = ArticleViewModel.index({ items: sources });

			return ctx.render(CMSArticlesIndexView, { items });
		}),

		/**
		 * Unauthenticated callers go to login. Both the failure and success paths answer with
		 * See Other so the browser leaves the mutating endpoint before any reload.
		 *
		 * @param ctx Request-scoped access to form data and database services.
		 * @returns Redirect response to login, index, or the edit page for the created article.
		 */
		create: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), ArticleSchema);
			succeeded(result, "Invalid article form data");
			let input = ArticleViewModel.input({ data: result.data });

			let created = await ArticlePost.create(db, {
				author_id: user.id,
				published_at: input.published_at,
				meta: input.meta,
			});

			if (!created)
				return redirect(routes.cms.articles.index.href(), { status: redirect.Status.SeeOther });

			return redirect(routes.cms.articles.edit.href({ id: created.id }), {
				status: redirect.Status.SeeOther,
			});
		}),

		/**
		 * A malformed action URL carrying no id lands the editor back on the index, keeping the
		 * CMS flow resilient.
		 *
		 * @param ctx Request context containing route params and database service.
		 * @returns Redirect response to the CMS article index.
		 */
		destroy: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.articles.index.href(), { status: redirect.Status.SeeOther });

			await ArticlePost.destroy(db, id);
			return redirect(routes.cms.articles.index.href(), { status: redirect.Status.SeeOther });
		}),

		/**
		 * An unknown id renders a 404 view inside the CMS shell so editors keep their context
		 * and learn immediately that the record is gone.
		 *
		 * @param ctx Request context with route params and database service.
		 * @returns SSR view response for edit form or not-found state.
		 */
		edit: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let id = ctx.params.id;
			let article = id ? await ArticlePost.findById(db, id) : null;

			if (!article) {
				let viewProps = ArticleViewModel.notFound({ id });
				return ctx.render(CMSArticlesActionView, viewProps, { status: 404 });
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

			return ctx.render(CMSArticlesActionView, viewProps);
		}),

		/**
		 * @returns SSR view response for the empty article form.
		 */
		async new(ctx) {
			let viewProps = ArticleViewModel.new({});

			return ctx.render(CMSArticlesActionView, viewProps);
		},

		/**
		 * Requires an authenticated user and a route id; either one missing sends the editor back
		 * to the index, while an unknown id renders the 404 CMS state in place.
		 *
		 * @param ctx Request-scoped access to params, form data, and database services.
		 * @returns Redirect response for success/guard paths or a 404 edit-state view.
		 */
		update: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(routes.cms.articles.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), ArticleSchema);
			succeeded(result, "Invalid article form data");
			let input = ArticleViewModel.input({ data: result.data });

			let updated = await ArticlePost.update(db, id, {
				author_id: user.id,
				published_at: input.published_at,
				meta: input.meta,
			});

			if (!updated) {
				let viewProps = ArticleViewModel.notFound({ id });
				return ctx.render(CMSArticlesActionView, viewProps, { status: 404 });
			}

			return redirect(routes.cms.articles.edit.href({ id }), { status: redirect.Status.SeeOther });
		}),
	},
});
