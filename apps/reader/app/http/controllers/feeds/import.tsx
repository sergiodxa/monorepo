/**
 * OPML import controller for `POST /feeds/import`. It reads the uploaded document and
 * hands every feed address in it to the reader's store, which follows the ones they do
 * not follow already.
 *
 * It renders nothing. The outcome travels in the `imported` query parameter of the
 * redirect back to the settings page the form lives on, which is the single place that
 * says what happened, in its own copy. The parameter carries exactly one of four values:
 *
 * - `done` — the document was read and its feeds handed to the store. Three further
 *   parameters carry what became of them, each an integer that reads as zero when it is
 *   absent: `added`, `following` for the ones already followed, and `failed`.
 * - `empty` — the document was read and lists no feeds.
 * - `unreadable` — the upload is not an OPML document.
 * - `too-large` — the upload is past the size this reads, so it was never parsed.
 * - `missing` — the form arrived without a file.
 *
 * A feed that could not be retrieved is counted, and the rest of the document is followed
 * regardless, so three failures out of fifty is a `done` import reporting three failures.
 * The failures are counted rather than named: the reader acts on how many there were, and
 * fifty addresses would travel through the browser's history and every log along the way.
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
import { userStore } from "~/database/user-do";
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
 * megabyte leaves room for a list far longer than anyone keeps.
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

	return redirect(`${routes.settings.index.href()}?${query}`, {
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

		let feedUrls = outlines.data.map((outline) => outline.feedUrl);
		if (feedUrls.length === 0) return toSettings("empty");

		let result = await userStore(viewer.id).importFeeds(feedUrls);

		/** The rail lists whatever the file brought in. */
		await forgetRailFeeds(viewer.id);

		return toSettings("done", {
			added: result.added,
			following: result.alreadyFollowing,
			failed: result.failed.length,
		});
	},
});
