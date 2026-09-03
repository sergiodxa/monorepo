/**
 * HTTP action for the public `/articles` index. Admin viewers also receive posts still
 * in preview. Data access stays in the repository layer so the controller composes and
 * renders only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { isAdmin } from "~/app/http/middleware/auth";
import { ArticlesViewModel } from "~/app/http/view-models/articles";
import { ArticlePost } from "~/app/repositories/posts/article";
import { ArticlesView } from "~/resources/views/articles";
import routes from "~/routes/web";

/**
 * Serves the public articles index as a server-rendered listing.
 * @returns HTML response for `GET /articles`.
 */
export default createAction(
	routes.articles,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let articles = await ArticlePost.listItems(db, { includePreview: isAdmin() });
		let model = ArticlesViewModel.index(articles);
		return ctx.render(ArticlesView, model);
	}),
);
