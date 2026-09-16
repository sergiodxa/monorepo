/**
 * Saved-search creation for `POST /searches`. It keeps the narrowing the reader is standing
 * in — the words, the read state and whatever feed they scoped to — and sends them back to
 * exactly that queue.
 *
 * It renders nothing. A saved search is a link rather than a surface, so the outcome
 * travels in the queue's own query and the queue says it, which leaves one renderer of
 * that list and one place for it to be described.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { forgetRailSearches } from "~/app/http/controllers/chrome";
import { FEED_PARAM, queueUrl, queueViewOf, SHOW_PARAM } from "~/app/http/controllers/queue-view";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import { SEARCH_PARAM } from "~/resources/layouts/app";
import routes from "~/routes/web";

/** The query parameter the queue reads the outcome of a saved-search action out of. */
export const SAVED_PARAM = "search";

/** The field a saved search's name is submitted under. */
export const NAME_FIELD = "name";

/**
 * The name, and the narrowing the queue this was sent from is reading under. A form posts
 * its own fields rather than the address it came from, so each of the three travels as a
 * field and an absent one reads as the queue with that narrowing off.
 */
const SaveForm = f.object({
	[NAME_FIELD]: f.field(s.defaulted(s.string(), "")),
	[SEARCH_PARAM]: f.field(s.defaulted(s.string(), "")),
	[SHOW_PARAM]: f.field(s.defaulted(s.string(), "")),
	[FEED_PARAM]: f.field(s.defaulted(s.string(), "")),
});

/** POST /searches — keeps the query the reader is reading under. */
export default createAction(routes.searches.create, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let submitted = s.parse(SaveForm, ctx.formData);

		/**
		 * Rebuilt from the submitted fields rather than from a whole address, so what comes
		 * back is a queue of this app's and never wherever a posted URL pointed.
		 */
		let view = queueViewOf(
			submitted[SEARCH_PARAM] ?? "",
			submitted[SHOW_PARAM] ?? "",
			submitted[FEED_PARAM] ?? "",
		);

		let kept = await userStore(viewer.id).createSearch({
			name: submitted[NAME_FIELD] ?? "",
			query: view.query,
			readState: view.readState,
			feedId: view.feedId,
		});

		/** The rail lists this query now, so the band drawn beside the next page counts it. */
		if (kept.ok) await forgetRailSearches(viewer.id);

		let outcome = kept.ok ? "saved" : kept.reason;

		return redirect(queueUrl(view, null, { [SAVED_PARAM]: outcome }), {
			status: redirect.Status.SeeOther,
		});
	},
});
