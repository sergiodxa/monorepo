import { redirect } from "@pkg/http/response";
import { succeeded } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import { getAuthUser } from "~/app/http/middleware/auth";
import { ArticleViewModel } from "~/app/http/view-models/cms/articles";
import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { ArticleSchema } from "~/app/schemas/cms/article";
import { CMSArticlesActionView, CMSArticlesIndexView } from "~/resources/views/cms/articles";
import routes from "~/routes/web";

/**
 * Handles CMS article CRUD flows for backoffice pages.
 *
 * The controller returns rendered HTML views for read/edit screens and See Other redirects
 * for mutating actions to preserve PRG behavior in the CMS.
 */
export default createController(routes.cms.articles, {
	/**
	 * Leaves route-level middleware empty because authentication is enforced by the CMS route group,
	 * while action-level guards still protect direct access or misconfigured mounts.
	 */
	middleware: [],

	actions: {
		/**
		 * Loads all articles and renders the CMS index table.
		 *
		 * The `preview` flag mirrors publish-state semantics via `Post.isPublishedAt`, where
		 * `null` and past timestamps are treated as published and future timestamps as preview.
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
		 * Creates a new article from validated form data.
		 *
		 * Redirects unauthenticated users to login and uses See Other redirects for both failure
		 * and success paths so form submissions never remain on a mutating endpoint.
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
		 * Deletes an article by route id and returns to the CMS index.
		 *
		 * Missing ids are treated as a non-action and redirected to index instead of surfacing
		 * an error page to keep the CMS flow resilient to malformed action URLs.
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
		 * Loads an article for editing and renders a not-found CMS state when absent.
		 *
		 * This action returns an HTML 404 view within the CMS shell instead of redirecting so
		 * editors get immediate feedback that the requested record no longer exists.
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
		 * Renders the empty article form for creating a new entry.
		 *
		 * @returns SSR view response for the new article form.
		 */
		async new(ctx) {
			let viewProps = ArticleViewModel.new({});

			return ctx.render(CMSArticlesActionView, viewProps);
		},

		/**
		 * Updates an existing article using validated form input.
		 *
		 * Requires both an authenticated user and route id; missing prerequisites short-circuit to
		 * index, while unknown ids render a 404 CMS state to keep editor context visible.
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
