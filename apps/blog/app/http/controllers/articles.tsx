/**
 * HTTP action for the public `/articles` index. Admin viewers also receive posts still
 * in preview. Data access stays in the repository layer so the controller composes and
 * renders only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { isAdmin } from "~/app/http/middleware/auth";
import { ArticlesViewModel } from "~/app/http/view-models/articles";
import { ArticlePost } from "~/app/repositories/posts/article";
import { PUBLIC_PAGE, TAGS } from "~/app/services/cache";
import { ArticlesView } from "~/resources/views/articles";
import routes from "~/routes/web";

/**
 * Serves the public articles index as a server-rendered listing.
 * @returns HTML response for `GET /articles`.
 */
export default createAction(routes.articles, async (ctx) => {
	let articles = await ArticlePost.listItems(ctx.db, { includePreview: isAdmin() });
	let model = ArticlesViewModel.index(articles);

	// An admin's listing carries unpublished posts, so it never reaches a shared cache.
	if (!isAdmin()) ctx.cache(PUBLIC_PAGE, TAGS.postList());

	return ctx.render(ArticlesView, model);
});
