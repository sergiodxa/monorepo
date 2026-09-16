/**
 * Saved-posts controller for `GET /saved`: the posts a reader asked to keep, newest first.
 *
 * It is the one list in this app that nothing prunes. Every other rule here eventually
 * takes a post away — the sweep behind read posts, the object's own budget, a feed's
 * velocity — and a reader needs one answer that outlasts all of them, so a post they keep
 * is exempt from each of them and stays until they say otherwise.
 *
 * The same list as every other surface, narrowed to what was kept: the rows, the marks on
 * them and the way through the pages are the timeline's, because a saved post is a post.
 * What sets this surface apart is what its rows already know — everything here is kept, so
 * every row's own mark is the one that stops keeping it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { vstack } from "@sdxc/u/layout";
import { Alert, Empty, HeadingScope, LinkButton } from "@sdxc/ui";
import { createAction } from "remix/router";

import { chrome } from "~/app/http/controllers/chrome";
import { placePage } from "~/app/http/controllers/list-paging";
import { timelineCopy, timelineEntries } from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { isFrameRequest } from "~/app/http/render";
import { userStore } from "~/database/user-do";
import AppLayout, { pageNote } from "~/resources/layouts/app";
import Timeline from "~/resources/views/timeline";
import routes from "~/routes/web";

/**
 * How many posts one page of the list holds, which is the number every other list here
 * shows: they are the same rows, and a page is sized to arrive under a reader scrolling
 * rather than to be complete.
 */
const PAGE_SIZE = 25;

/**
 * The URL of one page of the list, which is what the timeline's older and newer links
 * carry: the cursor alone would resolve against whatever page the browser is on.
 *
 * This surface is narrowed by nothing, so a page of it is its own path and a cursor.
 *
 * @param cursor - The boundary the store minted, or `null` for the newest page.
 * @param extra - Parameters this page's address has to carry beyond the cursor.
 */
function savedUrl(cursor: string | null, extra: Record<string, string> = {}): string {
	let params = new URLSearchParams();
	if (cursor !== null) params.set("cursor", cursor);
	for (let [name, value] of Object.entries(extra)) params.set(name, value);

	let query = params.toString();
	return query.length === 0 ? routes.saved.href() : `${routes.saved.href()}?${query}`;
}

/** GET /saved — the posts the reader asked to keep. */
export default createAction(routes.saved, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let store = userStore(viewer.id);

		/**
		 * A malformed paging parameter falls back to the newest page, which is what this URL
		 * shows without one, rather than to an error page the reader can do nothing about.
		 */
		let params = parsePageParams(ctx.url.searchParams);
		let cursor = isFailure(params) ? null : params.data.cursor;

		let page = await store.savedQueue({ cursor, limit: PAGE_SIZE });

		/**
		 * A cursor the store no longer decodes leaves the reader holding a place that is gone,
		 * so the newest page is shown with a note saying where they landed.
		 */
		let isStaleCursor = !page.ok;
		if (!page.ok) page = await store.savedQueue({ cursor: null, limit: PAGE_SIZE });
		if (!page.ok) throw new Error("The first page of a timeline decodes without a cursor");

		/** The list gathers every feed, so a row names the one its post came from. */
		let entries = timelineEntries(
			ctx,
			page.items,
			new Map(page.feeds.map((feed) => [feed.id, feed.title])),
		);

		let heading = ctx.i18next.t("saved.heading");

		/**
		 * Where this page sits in the list and what the ways off both ends of it are, worked
		 * out by the same code the other lists use: three surfaces holding different posts and
		 * paging through them identically.
		 */
		let placement = placePage({
			address: savedUrl,
			params: ctx.url.searchParams,
			cursor,
			isStaleCursor,
			rows: entries.length,
			pageSize: PAGE_SIZE,
			cursors: page.cursors,
		});

		let listCopy = timelineCopy(ctx.i18next);

		/**
		 * A frame asked for the piece that continues a list already on screen, so it is
		 * answered with that piece: the rows, numbered on from where the page above stopped,
		 * and whatever carries the reader on from the end of them.
		 */
		if (isFrameRequest(ctx.request)) {
			return ctx.render(
				isStaleCursor ? (
					/**
					 * The cursor the page above minted no longer decodes, so the list stops here and
					 * says so rather than starting again from the newest page underneath itself.
					 */
					<Alert color="warning" mix={pageNote()}>
						<Alert.Description>{ctx.i18next.t("timeline.badCursor")}</Alert.Description>
						<Alert.Action>
							<LinkButton href={routes.saved.href()} color="neutral" variant="outline" size="sm">
								{ctx.i18next.t("timeline.restart")}
							</LinkButton>
						</Alert.Action>
					</Alert>
				) : (
					<Timeline entries={entries} copy={listCopy} {...placement} />
				),
			);
		}

		return ctx.render(
			<AppLayout
				documentTitle={ctx.i18next.t("saved.title")}
				heading={heading}
				locale={ctx.locale}
				{...await chrome(ctx)}
			>
				<div mix={[vstack({ gap: 6 })]}>
					{isStaleCursor && (
						<Alert color="warning" mix={pageNote()}>
							<Alert.Description>{ctx.i18next.t("timeline.badCursor")}</Alert.Description>
							<Alert.Action>
								<LinkButton href={routes.saved.href()} color="neutral" variant="outline" size="sm">
									{ctx.i18next.t("timeline.restart")}
								</LinkButton>
							</Alert.Action>
						</Alert>
					)}

					{entries.length > 0 ? (
						<Timeline entries={entries} copy={listCopy} {...placement} />
					) : (
						/** Level 2, since the layout's own page heading is the document's only `h1`. */
						<HeadingScope level={2}>
							<Empty>
								<Empty.Title>{ctx.i18next.t("saved.empty.title")}</Empty.Title>
								<Empty.Description>{ctx.i18next.t("saved.empty.description")}</Empty.Description>
							</Empty>
						</HeadingScope>
					)}
				</div>
			</AppLayout>,
		);
	},
});
