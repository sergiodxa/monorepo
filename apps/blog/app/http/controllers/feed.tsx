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
import { siteActor } from "~/app/services/activitypub";
import { NEGOTIATED_ACTIVITY, PUBLIC_PAGE, TAGS } from "~/app/services/cache";
import { FeedView } from "~/resources/views/feed";
import routes from "~/routes/web";

/**
 * Handles the `/feed` route. The repository and view-model layers are the source of truth
 * for feed semantics, so this controller renders the activity exactly as they order it.
 * A request preferring ActivityStreams gets the actor document instead, kept out of the
 * edge cache, whose `id` names the canonical copy that carries the key.
 * @returns HTML response for the feed page, or the actor document.
 */
export default createAction(routes.feed, async function feedController(ctx) {
	let actor = await ctx.activityPub.respond(ctx.request, siteActor(), {
		cache: NEGOTIATED_ACTIVITY,
	});
	if (actor) return actor;

	let activity = await Feed.listActivity(ctx.models);
	let model = FeedViewModel.index(activity);

	ctx.cache(PUBLIC_PAGE, TAGS.postList());

	return ctx.render(FeedView, model, { headers: { Vary: "Accept" } });
});
