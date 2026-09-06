/**
 * Unfollow controller for `DELETE /feeds/:feedId`. It will drop the reader's subscription
 * and the unread items behind it; for now it renders the page's heading alone, so the
 * route, the guard, and the layout are exercised end to end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { maxIs, mi, p } from "@sdxc/u/size";
import { Heading } from "@sdxc/ui";
import { createAction } from "remix/router";

import requireUser from "~/app/http/middleware/require-user";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** DELETE /feeds/:feedId — unfollows a feed. */
export default createAction(routes.feeds.unfollow, {
	middleware: [requireUser],
	handler(ctx) {
		let title = ctx.i18next.t("feeds.unfollow.title");

		return ctx.render(
			<DocumentLayout title={title} locale={ctx.locale}>
				<main mix={[vstack({ gap: 6 }), maxIs("48rem"), mi("auto"), p(8)]}>
					<Heading level={1}>{title}</Heading>
				</main>
			</DocumentLayout>,
		);
	},
});
