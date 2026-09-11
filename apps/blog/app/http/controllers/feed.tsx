/**
 * HTTP action for the `/feed` route. Data loading lives in the feed repository and
 * view-shaping in the feed view model, keeping the handler on request orchestration
 * alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { FeedViewModel } from "~/app/http/view-models/feed";
import { Feed } from "~/app/repositories/feed";
import { PUBLIC_PAGE, TAGS } from "~/app/services/cache";
import { FeedView } from "~/resources/views/feed";
import routes from "~/routes/web";

/**
 * Handles the `/feed` route. The repository and view-model layers are the source of truth
 * for feed semantics, so this controller renders the activity exactly as they order it.
 * @returns HTML response for the feed page.
 */
export default createAction(routes.feed, async function feedController(ctx) {
	let activity = await Feed.listActivity(ctx.db);
	let model = FeedViewModel.index(activity);

	ctx.cache(PUBLIC_PAGE, TAGS.postList());

	return ctx.render(FeedView, model);
});
