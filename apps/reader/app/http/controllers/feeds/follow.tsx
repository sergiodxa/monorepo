/**
 * Follow controller for `POST /feeds`. It hands the submitted address to the reader's
 * store, which discovers the feed behind it and subscribes them. A subscription answers
 * with a redirect, so refreshing the feed list never submits the address a second time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { UnprocessableEntity } from "@sdxc/http/status-code";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import type { UserStore } from "~/database/user-do";

import { forgetRailFeeds } from "~/app/http/controllers/chrome";
import { renderFeedsPage } from "~/app/http/controllers/feeds/index";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/**
 * The submitted form. An absent or non-text field reads as the empty string, which the
 * store refuses as an address exactly as it refuses a reader's typo, so one branch
 * answers both.
 */
const FollowForm = f.object({ url: f.field(s.defaulted(s.string(), "")) });

/** The `feeds.follow.error.*` key explaining each way the store can refuse an address. */
const FOLLOW_ERROR_KEYS: Record<UserStore.FollowFailure, string> = {
	"invalid-url": "feeds.follow.error.invalidUrl",
	"not-found": "feeds.follow.error.notFound",
	unreachable: "feeds.follow.error.unreachable",
	"already-following": "feeds.follow.error.alreadyFollowing",
};

/** POST /feeds — follows a feed. */
export default createAction(routes.feeds.follow, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let store = userStore(viewer.id);
		let submitted = s.parseSafe(FollowForm, ctx.formData);
		let url = submitted.success ? submitted.value.url : "";

		let followed = await store.followFeed(url);

		/** The rail lists this feed now. */
		if (followed.ok) await forgetRailFeeds(viewer.id);

		if (followed.ok) {
			return redirect(routes.feeds.index.href(), { status: redirect.Status.SeeOther });
		}

		/**
		 * The whole feed page comes back with the refusal against the field, so the reader
		 * corrects the address where they typed it and keeps sight of what they follow.
		 *
		 * The newest subscriptions are the ones it comes back with: the form posts here with
		 * no cursor, so a refused address is answered from the end of the list a new
		 * subscription would appear at, and a cursor is never in play to go stale beside it.
		 */
		let page = await store.listFeeds();
		if (!page.ok)
			throw new Error("The first page of the subscription list decodes without a cursor");

		return renderFeedsPage(
			ctx,
			page.feeds,
			{ error: ctx.i18next.t(FOLLOW_ERROR_KEYS[followed.reason]), value: url },
			UnprocessableEntity,
			{ cursors: page.cursors },
		);
	},
});
