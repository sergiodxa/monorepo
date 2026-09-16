/**
 * The sidebar's feed band for `GET /sidebar/feeds`: every feed a reader follows and how
 * many posts of each are waiting, as the sidebar lists them.
 *
 * It answers a fragment of the chrome rather than a page. The band is the only part of the
 * sidebar that changes while a reader reads — opening a post moves a count — and by then
 * the page they are on may be several fetched pages long, so the band is redrawn on its own
 * instead of the document around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { currentLog } from "@sdxc/logger";
import { createAction } from "remix/router";

import type { CachedFeed } from "~/app/http/controllers/chrome";

import {
	groupByFolder,
	railFeeds,
	railSearches,
	SIDEBAR_PATH_PARAM,
} from "~/app/http/controllers/chrome";
import { queueUrl } from "~/app/http/controllers/queue-view";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { SidebarFeeds } from "~/resources/layouts/app";
import routes from "~/routes/web";

/** GET /sidebar/feeds — the feeds under the sidebar's own heading. */
export default createAction(routes.sidebar.feeds, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();

		/** The guard has already answered an anonymous request, so this holds a reader's id. */
		if (!viewer) return redirect(routes.home.href(), { status: redirect.Status.SeeOther });

		/**
		 * The page the band is drawn beside, which lights one of its rows. It is compared
		 * against the addresses the band builds and printed nowhere, so an address naming no
		 * page of this app simply lights none of them.
		 */
		let currentPath = ctx.url.searchParams.get(SIDEBAR_PATH_PARAM) ?? "";

		/**
		 * The grouping and the counts above it both come off the one list this request
		 * already holds, so a rail drawn under folder names costs the read it cost without
		 * them and a folder's number can never disagree with the rows beneath it.
		 */
		let rows = await railFeeds(viewer.id);

		/**
		 * The queries the reader kept, beside the feed list in the same cache: the sidebar is
		 * drawn on every page, and each of these is a narrowing rather than a count, so the
		 * entry stands until the reader changes what they hold.
		 */
		let searches = await railSearches(viewer.id);

		let { folders, unfiled, pinned, quiet } = groupByFolder(rows, ctx.locale);

		/**
		 * How many of the reader's feeds fell into the derived group, which is the number that
		 * says whether the threshold is drawing a line anybody recognizes. It counts feeds and
		 * names none of them.
		 */
		currentLog()?.set({ event: "user.rail.quiet", feeds: rows.length, quiet: quiet.length });

		/**
		 * The count becomes the words that say it here, where the dictionary is, so the
		 * sidebar prints what it is handed the way every other list in this app does. A feed
		 * with nothing waiting carries no label at all: a column of zeroes is noise.
		 */
		let toRow = (feed: CachedFeed) => ({
			id: feed.id,
			title: feed.title,
			imageUrl: feed.imageUrl,
			unreadCount: feed.unreadCount,
			unreadLabel:
				feed.unreadCount > 0 ? ctx.i18next.t("feeds.unread", { count: feed.unreadCount }) : null,
		});

		/**
		 * A band of the rail that is a heading and rows, with its sum already in words. It is
		 * drawn only where something is in it: a heading over nothing is a door onto an empty
		 * room, and the quiet group in particular exists only once a feed has fallen into it.
		 *
		 * @param label - The word heading the band.
		 * @param feeds - What is in it, which decides whether it is drawn at all.
		 */
		let toBand = (label: string, feeds: CachedFeed[]) => {
			if (feeds.length === 0) return null;

			let unreadCount = feeds.reduce((sum, feed) => sum + feed.unreadCount, 0);

			return {
				label,
				feeds: feeds.map(toRow),
				unreadCount,
				unreadLabel: unreadCount > 0 ? ctx.i18next.t("feeds.unread", { count: unreadCount }) : null,
			};
		};

		return ctx.render(
			<SidebarFeeds
				searchesLabel={ctx.i18next.t("searches.label")}
				/**
				 * Each one drawn as the queue's own address under the narrowing it holds, so
				 * opening a saved search is the same controller, the same statement and the same
				 * cursor grammar as typing the words it keeps.
				 */
				searches={searches.map((search) => ({
					id: search.id,
					label: search.name,
					href: queueUrl({
						query: search.query,
						readState: search.readState,
						feedId: search.feedId,
					}),
				}))}
				pinned={toBand(ctx.i18next.t("nav.pinned"), pinned)}
				quiet={toBand(ctx.i18next.t("nav.quiet"), quiet)}
				currentPath={currentPath}
				label={ctx.i18next.t("nav.feeds")}
				listLabel={ctx.i18next.t("nav.subscriptions")}
				folders={folders.map((folder) => ({
					id: folder.id,
					title: folder.title,
					href: routes.folder.href({ folder: folder.id }),
					feeds: folder.feeds.map(toRow),
					unreadCount: folder.unreadCount,
					unreadLabel:
						folder.unreadCount > 0
							? ctx.i18next.t("feeds.unread", { count: folder.unreadCount })
							: null,
				}))}
				feeds={unfiled.map(toRow)}
			/>,
		);
	},
});
