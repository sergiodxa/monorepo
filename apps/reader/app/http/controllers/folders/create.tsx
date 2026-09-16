/**
 * Folder creation for `POST /folders`. It makes a named group for subscriptions and sends
 * the reader to the stream that group reads as.
 *
 * It renders nothing. The outcome travels in the `folder` query parameter of the redirect,
 * so a folder's own page is the single place that says what happened, in its own copy. The
 * parameter carries one of two values:
 *
 * - `created` — the folder is now the reader's, and they are standing in it.
 * - `duplicate` — they already had one by that name, and they are standing in that one,
 *   which is where a reader asking for a folder by name meant to end up.
 *
 * A name of nothing but space is refused by the field itself before it is sent, so the
 * store's refusal of one is the guard behind that rather than a sentence anybody reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { forgetRailFeeds } from "~/app/http/controllers/chrome";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The query parameter a folder's page reads the outcome of a folder action out of. */
export const FOLDER_PARAM = "folder";

/** The field a folder's name is submitted under, wherever one is named. */
export const TITLE_FIELD = "title";

/** The name the form submits, which the store trims and holds to its unique index. */
const TitleForm = f.object({ [TITLE_FIELD]: f.field(s.defaulted(s.string(), "")) });

/**
 * Where a folder's own page is, carrying what just happened to it.
 *
 * @param folderId - The folder to stand in.
 * @param outcome - What to tell the reader once they are there.
 */
export function folderPage(folderId: string, outcome: string): string {
	let query = new URLSearchParams({ [FOLDER_PARAM]: outcome });
	return `${routes.folder.href({ folder: folderId })}?${query}`;
}

/** POST /folders — makes a folder to file feeds into. */
export default createAction(routes.folders.create, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let submitted = s.parse(TitleForm, ctx.formData);
		let store = userStore(viewer.id);

		let created = await store.createFolder(submitted[TITLE_FIELD]);

		if (created.ok) {
			/** The rail draws folders, so the list it draws them from is now out of date. */
			await forgetRailFeeds(viewer.id);

			return redirect(folderPage(created.folder.id, "created"), {
				status: redirect.Status.SeeOther,
			});
		}

		/**
		 * A reader who asked for a folder by a name they already use asked for the folder
		 * they have, so they are taken to it rather than told they cannot have it twice.
		 */
		if (created.reason === "duplicate-title") {
			let name = submitted[TITLE_FIELD].trim();
			let existing = (await store.listFolders()).find((folder) => folder.title === name);

			if (existing) {
				return redirect(folderPage(existing.id, "duplicate"), {
					status: redirect.Status.SeeOther,
				});
			}
		}

		/** Nothing was named, so nothing happened and the reader is left where they read. */
		return redirect(routes.reading.index.href(), { status: redirect.Status.SeeOther });
	},
});
