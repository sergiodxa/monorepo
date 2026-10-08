/**
 * Data export controller for `GET /settings/export.zip`: everything a reader keeps, in one
 * ZIP, so leaving with their library takes one click. The subscription list goes as OPML,
 * the kept posts as CSV, and both as one JSON file for a script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { Zip } from "@sdxc/zip";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import {
	exportFilename,
	readerDataJson,
	savedPostsCsv,
	subscriptionsOpml,
} from "~/app/lib/data-export";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/**
 * GET /settings/export.zip — `subscriptions.opml`, `saved-posts.csv` and `reader-data.json`
 * in one archive, dated the moment it was taken. It is one person's library, assembled for
 * them alone, so it is stored nowhere on the way; a reader with nothing gets the same files
 * with nothing in them.
 */
export default createAction(routes.dataExport, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let store = userStore(viewer.id);
		let [feeds, saved] = await Promise.all([store.exportFeeds(), store.exportSaved()]);
		let now = new Date();

		let csv = savedPostsCsv(saved);
		if (isFailure(csv)) {
			ctx.log.fail(csv.error, { export: { saved: saved.length } });
			return new Response(ctx.intl.t("feeds.transfer.exportFailed"), { status: 500 });
		}

		let zip = new Zip();
		let entries: [string, string][] = [
			[
				"subscriptions.opml",
				subscriptionsOpml(feeds, ctx.intl.t("feeds.transfer.documentTitle"), now),
			],
			["saved-posts.csv", csv.data],
			["reader-data.json", readerDataJson(feeds, saved, now)],
		];
		for (let [name, text] of entries) {
			let added = zip.add(name, text, { modified: now });
			if (isFailure(added)) {
				ctx.log.fail(added.error, { export: { entry: name } });
				return new Response(ctx.intl.t("feeds.transfer.exportFailed"), { status: 500 });
			}
		}

		return new Response(zip.stream(), {
			headers: {
				"content-type": "application/zip",
				"content-disposition": `attachment; filename="${exportFilename("export", "zip", now)}"`,
				/** One reader's whole library, kept out of every cache between here and them. */
				"cache-control": "private, no-store",
			},
		});
	},
});
