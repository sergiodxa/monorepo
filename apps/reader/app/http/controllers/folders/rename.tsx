/**
 * Folder renaming for `POST /folders/:folderId`. It changes the name a group of
 * subscriptions reads under and returns the reader to that group's own page.
 *
 * It renders nothing. The outcome travels in the `folder` query parameter of the redirect,
 * so the folder's page is the single place that says what happened, in its own copy. The
 * parameter carries one of three values:
 *
 * - `renamed` — the folder now reads under the name they chose.
 * - `duplicate` — another folder of theirs already reads under it.
 * - `invalid` — the name held nothing but space.
 *
 * Renaming touches one row and moves no post: everything else holds the folder by its id,
 * which a name never was.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import type { UserStore } from "~/database/user-do";

import { forgetRailFeeds } from "~/app/http/controllers/chrome";
import { folderPage, TITLE_FIELD } from "~/app/http/controllers/folders/create";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The path this route matches, which carries the folder being renamed. */
const Params = s.object({ folderId: s.string() });

/** The name the form submits, which the store trims and holds to its unique index. */
const TitleForm = f.object({ [TITLE_FIELD]: f.field(s.defaulted(s.string(), "")) });

/** What each refusal travels back to the folder's page as. */
const RENAME_OUTCOMES: Record<UserStore.FolderFailure, string> = {
	"duplicate-title": "duplicate",
	"invalid-title": "invalid",
	/** Read by nobody: the page a folder that is gone answers with is its own not-found. */
	"not-found": "missing",
};

/** POST /folders/:folderId — renames one folder. */
export default createAction(routes.folders.rename, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { folderId } = s.parse(Params, ctx.params);
		let submitted = s.parse(TitleForm, ctx.formData);

		let renamed = await userStore(viewer.id).renameFolder(folderId, submitted[TITLE_FIELD]);

		/** The rail draws the name, so the list it draws it from is now out of date. */
		if (renamed.ok) await forgetRailFeeds(viewer.id);

		/**
		 * A folder this reader does not have is answered by the page they land on, which
		 * reports a folder that is not there rather than repeating that here.
		 */
		let outcome = renamed.ok ? "renamed" : RENAME_OUTCOMES[renamed.reason];

		return redirect(folderPage(folderId, outcome), { status: redirect.Status.SeeOther });
	},
});
