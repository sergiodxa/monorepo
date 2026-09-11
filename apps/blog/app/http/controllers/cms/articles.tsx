/**
 * CMS controller for article CRUD. It renders index and edit/new HTML views and handles
 * create, update, and destroy actions, validating form data against the article schema and
 * using See Other redirects to preserve post/redirect/get flow. It exists to manage
 * articles from the backoffice, returning in-context 404 views for missing records.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { succeeded } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import { getAuthUser } from "~/app/http/middleware/auth";
import { ArticleViewModel } from "~/app/http/view-models/cms/articles";
import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { ArticleSchema } from "~/app/schemas/cms/article";
import { TAGS } from "~/app/services/cache";
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
		 * @param ctx Request context carrying the database.
		 * @returns SSR view response for the article listing page.
		 */
		index: async (ctx) => {
			let articles = await ArticlePost.findAll(ctx.db, { includePreview: true });
			let sources: Array<ArticleViewModel.SourceIndexItem> = articles.map((article) => ({
				id: article.id,
				title: article.meta.title,
				slug: article.meta.slug,
				preview: !Post.isPublishedAt(article.published_at),
			}));
			let items = ArticleViewModel.index({ items: sources });

			return ctx.render(CMSArticlesIndexView, { items });
		},

		/**
		 * Unauthenticated callers go to login. Both the failure and success paths answer with
		 * See Other so the browser leaves the mutating endpoint before any reload.
		 *
		 * @param ctx Request context carrying the submitted form data and the database.
		 * @returns Redirect response to login, index, or the edit page for the created article.
		 */
		create: async (ctx) => {
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), ArticleSchema);
			succeeded(result, "Invalid article form data");
			let input = ArticleViewModel.input({ data: result.data });

			let created = await ArticlePost.create(ctx.db, {
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

		/**
		 * A malformed action URL carrying no id lands the editor back on the index, keeping the
		 * CMS flow resilient.
		 *
		 * @param ctx Request context carrying the route params and the database.
		 * @returns Redirect response to the CMS article index.
		 */
		destroy: async (ctx) => {
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.articles.index.href(), { status: redirect.Status.SeeOther });

			// Read before deleting: the public page is cached under its slug, which
			// only the record carries.
			let article = await ArticlePost.findById(ctx.db, id);

			await ArticlePost.destroy(ctx.db, id);

			if (article) ctx.cache.purgeLater(TAGS.post("articles", article.meta.slug));

			return redirect(routes.cms.articles.index.href(), { status: redirect.Status.SeeOther });
		},

		/**
		 * An unknown id renders a 404 view inside the CMS shell so editors keep their context
		 * and learn immediately that the record is gone.
		 *
		 * @param ctx Request context carrying the route params and the database.
		 * @returns SSR view response for edit form or not-found state.
		 */
		edit: async (ctx) => {
			let id = ctx.params.id;
			let article = id ? await ArticlePost.findById(ctx.db, id) : null;

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
		},

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
		 * @param ctx Request context carrying the route params, form data, and the database.
		 * @returns Redirect response for success/guard paths or a 404 edit-state view.
		 */
		update: async (ctx) => {
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(routes.cms.articles.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), ArticleSchema);
			succeeded(result, "Invalid article form data");
			let input = ArticleViewModel.input({ data: result.data });

			// Read before writing: an edit that renames the slug leaves the old URL
			// cached, and only the stored record still knows what it was.
			let previous = await ArticlePost.findById(ctx.db, id);

			let updated = await ArticlePost.update(ctx.db, id, {
				author_id: user.id,
				published_at: input.published_at,
				meta: input.meta,
			});

			if (!updated) {
				let viewProps = ArticleViewModel.notFound({ id });
				return ctx.render(CMSArticlesActionView, viewProps, { status: 404 });
			}

			let slugs = new Set([input.meta.slug]);
			if (previous) slugs.add(previous.meta.slug);
			ctx.cache.purgeLater(...[...slugs].map((slug) => TAGS.post("articles", slug)));

			return redirect(routes.cms.articles.edit.href({ id }), { status: redirect.Status.SeeOther });
		},
	},
});
