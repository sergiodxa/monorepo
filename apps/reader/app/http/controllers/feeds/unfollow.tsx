/**
 * Unfollow controller for `DELETE /feeds/:feedId`. It drops the reader's subscription and
 * every post behind it, then sends them back to the list, which is the page that no longer
 * shows the feed. It is reached from a form posting `_method=DELETE`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { NotFound } from "@sdxc/http/status-code";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { maxIs } from "@sdxc/u/size";
import { leading, text } from "@sdxc/u/typography";
import { LinkButton, Text } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { chrome, forgetRailFeeds } from "~/app/http/controllers/chrome";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import AppLayout from "~/resources/layouts/app";
import routes from "~/routes/web";

/** The path this route matches, which carries the subscription to drop. */
const Params = s.object({ feedId: s.string() });

/** DELETE /feeds/:feedId — unfollows a feed. */
export default createAction(routes.feeds.unfollow, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { feedId } = s.parse(Params, ctx.params);
		let unfollowed = await userStore(viewer.id).unfollowFeed(feedId);

		/** The rail no longer lists this feed. */
		await forgetRailFeeds(viewer.id);

		if (unfollowed) {
			return redirect(routes.reading.href(), { status: redirect.Status.SeeOther });
		}

		let title = ctx.i18next.t("feeds.show.notFound.title");

		return ctx.render(
			<AppLayout documentTitle={title} heading={title} locale={ctx.locale} {...await chrome(ctx)}>
				<div mix={[vstack({ gap: 4, align: "start" })]}>
					<Text mix={[text("sm"), leading("relaxed"), fg("neutral.muted"), maxIs("42rem")]}>
						{ctx.i18next.t("feeds.show.notFound.description")}
					</Text>

					<LinkButton href={routes.reading.href()} color="neutral" variant="outline">
						{ctx.i18next.t("feeds.show.notFound.back")}
					</LinkButton>
				</div>
			</AppLayout>,
			NotFound,
		);
	},
});
