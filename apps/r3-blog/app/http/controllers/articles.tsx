import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { isAdmin } from "~/app/http/middleware/auth";
import { ArticlesViewModel } from "~/app/http/view-models/articles";
import { ArticlePost } from "~/app/repositories/posts/article";
import { ArticlesView } from "~/resources/views/articles";
import routes from "~/routes/web";

/**
 * Serves the public articles index by composing repository data into a server-rendered HTML response.
 * Contract: resolve `Database` from route context, map items through the view model, and render `ArticlesView`.
 */
export default createAction(
	routes.articles,
	/**
	 * Handles `GET /articles` using request-scoped dependencies from the route context.
	 * @param ctx Route context that must provide a `Database` instance.
	 * @returns HTML response for the articles listing page.
	 * @example GET /articles
	 */
	async (ctx) => {
		let articles = await ArticlePost.listItems(ctx.get(Database), { includePreview: isAdmin() });
		let model = ArticlesViewModel.index(articles);
		return ctx.render(ArticlesView, model);
	},
);
