import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

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
