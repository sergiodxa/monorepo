/**
 * HTTP action for the `/feed` route. Data loading lives in the feed repository and
 * view-shaping in the feed view model, keeping the handler on request orchestration
 * alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { FeedViewModel } from "~/app/http/view-models/feed";
import { Feed } from "~/app/repositories/feed";
import { FeedView } from "~/resources/views/feed";
import routes from "~/routes/web";

/**
 * Handles the `/feed` route. The repository and view-model layers are the source of truth
 * for feed semantics, so this controller renders the activity exactly as they order it.
 * @returns HTML response for the feed page.
 */
export default createAction(
	routes.feed,
	inject([Database] as const, async function feedController(db) {
		let ctx = getContext();
		let activity = await Feed.listActivity(db);
		let model = FeedViewModel.index(activity);

		return ctx.render(FeedView, model);
	}),
);
