import action from "@pkg/remix-helpers/action";
import { Database } from "remix/data-table";

import type routes from "~/routes/web";

import { FeedViewModel } from "~/app/http/view-models/feed";
import { view } from "~/app/infrastructure/view";
import { Feed } from "~/app/repositories/feed";
import { FeedView } from "~/resources/views/feed";

/**
 * Handles the `/feed` route by loading feed activity and rendering HTML.
 *
 * This controller keeps data loading in the repository layer and view-shaping
 * in the view model so the HTTP handler remains focused on request orchestration.
 *
 * @example `action(routes.feed, handler)` maps GET `/feed` to this controller.
 */
export default action<typeof routes.feed>(
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
	 * @returns HTML response produced by `view(FeedView, model)`.
	 */
	async function feedController(ctx) {
		let activity = await Feed.listActivity(ctx.get(Database));
		let model = FeedViewModel.index(activity);

		return view(FeedView, model);
	},
);
