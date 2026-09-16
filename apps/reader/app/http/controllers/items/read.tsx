/**
 * Mark-as-read controller for `POST /items/:itemId/read`. It takes one post out of the
 * queue, or puts it back, and returns the reader to the page they acted from, so working
 * through a timeline stays a run of submissions against the same list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { Alert } from "@sdxc/ui";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { chrome, forgetRailFeeds } from "~/app/http/controllers/chrome";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import { READ_IN_PLACE_HEADER } from "~/resources/components/read-toggle";
import AppLayout, { pageNote } from "~/resources/layouts/app";
import routes from "~/routes/web";

/** Status for a post this reader has nothing stored for. */
const NOT_FOUND_STATUS = 404;

/** Status for a move that stood and has nothing to say beyond that. */
const MOVED_STATUS = 204;

/** The post the URL names. */
const ItemParams = s.object({ itemId: s.string() });

/**
 * The form the timeline posts. Both fields carry a default, so a submission missing one
 * still marks the post read and lands back on the queue.
 */
const ReadForm = f.object({
	read: f.field(s.defaulted(s.string(), "true").transform((value) => value === "true")),
	returnTo: f.field(s.defaulted(s.string(), "")),
});

/**
 * Narrows a submitted destination to a path inside this app, falling back to the queue.
 *
 * The value arrives in a form field, so it carries whatever was posted: only a path
 * beginning with a single `/` stays within this origin, since `//host` and `/\host` are
 * both read by browsers as an address somewhere else.
 *
 * @param returnTo - The destination the form submitted.
 */
function localPath(returnTo: string): string {
	let isRelative =
		returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.startsWith("/\\");

	return isRelative ? returnTo : routes.reading.href();
}

/** POST /items/:itemId/read — marks one post read or unread. */
export default createAction(routes.items.read, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();

		/** The guard has already answered an anonymous request, so this holds a reader's id. */
		if (!viewer) return redirect(routes.home.href(), { status: redirect.Status.SeeOther });

		let { itemId } = s.parse(ItemParams, ctx.params);
		let { read, returnTo } = s.parse(ReadForm, ctx.formData);

		let marked = await userStore(viewer.id).markRead(itemId, read);

		/** The rail counts this post among its feed's unread, so it is dropped as the reader moves it rather than a moment later. */
		await forgetRailFeeds(viewer.id);

		/**
		 * The row moved its own mark and is asking only whether the move stood, so that is the
		 * whole answer. Sending the page back would be sending the first page of a queue the
		 * reader has scrolled several pages into, which is the thing this path exists to avoid.
		 */
		if (ctx.request.headers.has(READ_IN_PLACE_HEADER)) {
			return new Response(null, { status: marked ? MOVED_STATUS : NOT_FOUND_STATUS });
		}

		if (marked) {
			return redirect(localPath(returnTo), { status: redirect.Status.SeeOther });
		}

		return ctx.render(
			<AppLayout
				documentTitle={ctx.i18next.t("items.read.title")}
				heading={ctx.i18next.t("items.read.title")}
				locale={ctx.locale}
				{...await chrome(ctx)}
			>
				<Alert color="warning" mix={pageNote()}>
					<Alert.Content>
						<Alert.Description>{ctx.i18next.t("items.read.notFound")}</Alert.Description>
					</Alert.Content>
				</Alert>
			</AppLayout>,
			{ status: NOT_FOUND_STATUS },
		);
	},
});
