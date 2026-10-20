/**
 * OPML import controller for `POST /feeds/import`. It reads the uploaded document and
 * hands every feed address in it, with the folder its outline named, to the reader's
 * store, which follows the ones they do not follow already and files what it followed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { parse } from "@sdxc/opml";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { forgetRailFeeds } from "~/app/http/controllers/chrome";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/app/models/user-store";
import routes from "~/routes/web";

/** The file field the upload arrives in. */
export const FILE_FIELD = "file";

/** The query parameter the settings page reads the outcome of an import out of. */
export const IMPORTED_PARAM = "imported";

/** What one value of {@link IMPORTED_PARAM} can be. */
type Imported = "done" | "empty" | "unreadable" | "too-large" | "missing";

/** What a `done` import reports, each count under a query parameter of its own. */
interface Counts {
	added: number;
	following: number;
	failed: number;
}

/**
 * The largest upload read as OPML. A subscription list of several thousand feeds stays
 * inside a couple of hundred kilobytes, and this runs in a Worker holding the text, the
 * outlines parsed out of it and the addresses taken from those at the same time, so a
 */
const MAX_UPLOAD_BYTES = 1024 * 1024;

/**
 * Returns the reader to the settings page with what became of the upload.
 *
 * @param imported - The outcome, which the settings page turns into its own copy.
 * @param counts - What the store made of the document, on an import that ran.
 */
function toSettings(imported: Imported, counts?: Counts) {
	let query = new URLSearchParams({ [IMPORTED_PARAM]: imported });

	if (counts) {
		query.set("added", String(counts.added));
		query.set("following", String(counts.following));
		query.set("failed", String(counts.failed));
	}

	return redirect(`${routes.settings.href()}?${query}`, {
		status: redirect.Status.SeeOther,
	});
}

/** POST /feeds/import — follows every feed an uploaded OPML document lists. */
export default createAction(routes.feeds.import, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let upload = ctx.formData.get(FILE_FIELD);

		/**
		 * A submit with the file input left alone sends an empty part, which is the same
		 * nothing as a form that carries no file field at all.
		 */
		if (!(upload instanceof File) || upload.size === 0) return toSettings("missing");

		/** The size decides before the bytes are read, so an implausible upload never becomes a string. */
		if (upload.size > MAX_UPLOAD_BYTES) return toSettings("too-large");

		let outlines = parse(await upload.text());
		if (isFailure(outlines)) return toSettings("unreadable");

		/**
		 * The folder each outline named comes across with it, so a document that arrived
		 * filed is followed filed. A feed the reader already follows keeps the folder they
		 * put it in, which the store is what decides.
		 */
		let entries = outlines.data.map((outline) => ({
			feedUrl: outline.feedUrl,
			folder: outline.folder ?? null,
		}));

		if (entries.length === 0) return toSettings("empty");

		let result = await userStore(viewer.id).importFeeds(entries);

		/** The rail lists whatever the file brought in. */
		await forgetRailFeeds(viewer.id);

		return toSettings("done", {
			added: result.added,
			following: result.alreadyFollowing,
			failed: result.failed.length,
		});
	},
});
