/**
 * HTTP action for the public `/bookmarks` page. It fetches liked-post records from the
 * database, maps them through the bookmarks view model, and renders the bookmarks HTML
 * view. It exists to keep bookmark retrieval in the repository layer rather than issuing
 * SQL from the controller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { BookmarksViewModel } from "~/app/http/view-models/bookmarks";
import { LikePost } from "~/app/repositories/posts/like";
import { BookmarksView } from "~/resources/views/bookmarks";
import routes from "~/routes/web";

/**
 * Serves the bookmarks page by orchestrating liked-post retrieval and view-model shaping.
 * The route contract is an HTML response backed by repository data, not direct SQL in the controller.
 * @returns Server-rendered bookmarks page response.
 */
export default createAction(
	routes.bookmarks,
	/**
	 * Resolves the database dependency from the request context and fetches liked posts.
	 * Transforms repository records into the view model expected by `BookmarksView`.
	 * @param ctx Action context that provides dependency resolution for the current request.
	 * @returns Server-rendered bookmarks page response.
	 */
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let bookmarks = await LikePost.findAll(db);
		let model = BookmarksViewModel.index(bookmarks);

		return ctx.render(BookmarksView, model);
	}),
);
