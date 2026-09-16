/**
 * Save controller for `POST /items/:itemId/save`. It keeps one post, or stops keeping it,
 * and returns the reader to the page they acted from, so working down a timeline stays a
 * run of submissions against the same list.
 *
 * A kept post is exempt from every rule that deletes one, which is why the shelf has a
 * limit — and why a full one is refused rather than made room on: dropping the oldest save
 * would delete the one thing a reader explicitly asked to keep. The reader is told they
 * are full and which way out they have, and nothing is taken from them here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { Alert } from "@sdxc/ui";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { chrome } from "~/app/http/controllers/chrome";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import { SAVE_IN_PLACE_HEADER, SHELF_FULL_STATUS } from "~/resources/components/save-toggle";
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
 * still keeps the post and lands back on the queue.
 */
const SaveForm = f.object({
	saved: f.field(s.defaulted(s.string(), "true").transform((value) => value === "true")),
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

/** POST /items/:itemId/save — keeps one post, or stops keeping it. */
export default createAction(routes.items.save, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();

		/** The guard has already answered an anonymous request, so this holds a reader's id. */
		if (!viewer) return redirect(routes.home.href(), { status: redirect.Status.SeeOther });

		let { itemId } = s.parse(ItemParams, ctx.params);
		let { saved, returnTo } = s.parse(SaveForm, ctx.formData);

		let result = await userStore(viewer.id).saveItem(itemId, saved);

		/**
		 * The row moved its own mark and is asking only what became of the move, so that is
		 * the whole answer. A full shelf is told apart from a post that is not there, since
		 * the row says a different thing for each.
		 */
		if (ctx.request.headers.has(SAVE_IN_PLACE_HEADER)) {
			if (result.ok) return new Response(null, { status: MOVED_STATUS });

			return new Response(null, {
				status: result.reason === "full" ? SHELF_FULL_STATUS : NOT_FOUND_STATUS,
			});
		}

		if (result.ok) return redirect(localPath(returnTo), { status: redirect.Status.SeeOther });

		/**
		 * A full shelf is the reader's to clear, so the page says so and offers nothing that
		 * would clear it for them. It is a warning rather than a failure: nothing was lost,
		 * and everything already kept is still kept.
		 */
		let isFull = result.reason === "full";

		return ctx.render(
			<AppLayout
				documentTitle={ctx.i18next.t("items.save.title")}
				heading={ctx.i18next.t("items.save.title")}
				locale={ctx.locale}
				{...await chrome(ctx)}
			>
				<Alert color="warning" mix={pageNote()}>
					<Alert.Content>
						<Alert.Description>
							{isFull ? ctx.i18next.t("items.save.full") : ctx.i18next.t("items.save.notFound")}
						</Alert.Description>
					</Alert.Content>
				</Alert>
			</AppLayout>,
			{ status: isFull ? SHELF_FULL_STATUS : NOT_FOUND_STATUS },
		);
	},
});
