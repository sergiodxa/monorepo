/**
 * Filing for `POST /feeds/:feedId/folder`. It puts one subscription into a folder, or
 * takes it out of the one it is in, and returns the reader to that feed's own page.
 *
 * It renders nothing. The outcome travels in the `folder` query parameter of the redirect,
 * so the feed page is the single place that says what happened, in its own copy. The
 * parameter carries one of five values:
 *
 * - `filed` — the feed and its posts are now in the folder.
 * - `unfiled` — the feed is back among the ones filed nowhere.
 * - `gone` — the folder named is not one this reader has.
 * - `invalid` — a new folder was asked for under a name of nothing but space.
 * - `missing` — the reader does not follow that feed.
 *
 * A name creates the folder when the reader has none by it, which is where most folders
 * come from: filing a feed is the moment somebody decides a group exists.
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
import { FOLDER_PARAM, TITLE_FIELD } from "~/app/http/controllers/folders/create";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The field naming the folder to file into, whose empty value takes the feed out of one. */
export const FOLDER_FIELD = "folderId";

/** The path this route matches, which carries the subscription being filed. */
const Params = s.object({ feedId: s.string() });

/**
 * What the feed page's control submits: the folder it picked, or a name for a new one. A
 * name wins where both arrive, since typing one is the more deliberate of the two.
 */
const FilingForm = f.object({
	[FOLDER_FIELD]: f.field(s.defaulted(s.string(), "")),
	[TITLE_FIELD]: f.field(s.defaulted(s.string(), "")),
});

/** What each refusal travels back to the feed's page as. */
const FILING_OUTCOMES: Record<"not-following" | "not-found" | "invalid-title", string> = {
	"not-following": "missing",
	"not-found": "gone",
	"invalid-title": "invalid",
};

/**
 * Where the submission is filing the feed: under a name, into a folder that exists, or
 * nowhere — which is what an empty field means, since that is the control that unfiles.
 *
 * @param submitted - The form as it arrived.
 */
function target(submitted: Record<string, string>): UserStore.FolderTarget {
	let title = (submitted[TITLE_FIELD] ?? "").trim();
	if (title.length > 0) return { title };

	let folderId = submitted[FOLDER_FIELD] ?? "";
	return folderId.length > 0 ? { folderId } : null;
}

/** POST /feeds/:feedId/folder — files one feed, or takes it out of its folder. */
export default createAction(routes.folders.file, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { feedId } = s.parse(Params, ctx.params);
		let submitted = s.parse(FilingForm, ctx.formData);

		let filed = await userStore(viewer.id).fileFeed(feedId, target(submitted));

		/** The rail draws feeds under their folders, so where this one is drawn has moved. */
		if (filed.ok) await forgetRailFeeds(viewer.id);

		let outcome = filed.ok
			? filed.folder === null
				? "unfiled"
				: "filed"
			: FILING_OUTCOMES[filed.reason];

		let query = new URLSearchParams({ [FOLDER_PARAM]: outcome });

		return redirect(`${routes.feed.href({ feed: feedId })}?${query}`, {
			status: redirect.Status.SeeOther,
		});
	},
});
