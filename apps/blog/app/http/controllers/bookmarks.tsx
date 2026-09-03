/**
 * HTTP action for the public `/bookmarks` page. Liked-post retrieval stays in the
 * repository layer, so the controller maps records through the bookmarks view model and
 * renders the HTML view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { BookmarksViewModel } from "~/app/http/view-models/bookmarks";
import { LikePost } from "~/app/repositories/posts/like";
import { BookmarksView } from "~/resources/views/bookmarks";
import routes from "~/routes/web";

/**
 * Serves the bookmarks page from persisted liked-post records.
 * @returns Server-rendered bookmarks page response.
 */
export default createAction(
	routes.bookmarks,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let bookmarks = await LikePost.findAll(db);
		let model = BookmarksViewModel.index(bookmarks);

		return ctx.render(BookmarksView, model);
	}),
);
