/**
 * HTTP action for the `/feed` route. It loads combined activity from the feed
 * repository, normalizes it through the feed view model, and renders the feed HTML view.
 * It exists to keep the handler focused on request orchestration while data loading and
 * view-shaping stay in the repository and view-model layers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { FeedViewModel } from "~/app/http/view-models/feed";
import { Feed } from "~/app/repositories/feed";
import { FeedView } from "~/resources/views/feed";
import routes from "~/routes/web";

/**
 * Handles the `/feed` route by loading feed activity and rendering HTML.
 *
 * This controller keeps data loading in the repository layer and view-shaping
 * in the view model so the HTTP handler remains focused on request orchestration.
 *
 * @example `action(routes.feed, handler)` maps GET `/feed` to this controller.
 */
export default createAction(
	routes.feed,
	/**
	 * Coordinates feed rendering for a single request lifecycle.
	 *
	 * Contract:
	 * - Reads the request-scoped database instance from `ctx`.
	 * - Delegates activity retrieval to `Feed.listActivity`.
	 * - Normalizes repository output through `FeedViewModel.index` before render.
	 *
	 * Non-obvious behavior: this handler does not apply extra filtering/sorting;
	 * repository and view-model layers are the source of truth for feed semantics.
	 *
	 * @param ctx Route context that provides dependency access for this request.
	 * @returns HTML response produced by `ctx.render(FeedView, model)`.
	 */
	inject([Database] as const, async function feedController(db) {
		let ctx = getContext();
		let activity = await Feed.listActivity(db);
		let model = FeedViewModel.index(activity);

		return ctx.render(FeedView, model);
	}),
);
