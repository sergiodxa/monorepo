/**
 * Reading-queue controller for `GET /reading`: the unread posts across every followed
 * feed, newest first, and the app's landing spot after sign-in. On the queue's own line
 * sits the way to clear the whole of it at once, for a reader far enough behind that
 * starting fresh beats working through the backlog.
 *
 * The store answers with posts and, beside them, the feeds those posts came from. Turning
 * that into the row a reader sees happens here, where the dictionary and the request's
 * language are, so the list itself prints text it is handed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { vstack } from "@sdxc/u/layout";
import { Alert, Button, Confirm, Empty, HeadingScope, LinkButton } from "@sdxc/ui";
import { createAction } from "remix/router";

import { MARKED_PARAM } from "~/app/http/controllers/read-all";
import { timelineEntries } from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import AppLayout from "~/resources/layouts/app";
import Timeline from "~/resources/views/timeline";
import routes from "~/routes/web";

/**
 * The URL of one page of the queue, which is what the timeline's older and newer links
 * carry: the cursor alone would resolve against whatever page the browser is on.
 *
 * @param cursor - The boundary the store minted, or `null` at either end of the queue.
 */
function queuePage(cursor: string | null): string | null {
	if (cursor === null) return null;
	return `${routes.reading.href()}?${new URLSearchParams({ cursor })}`;
}

/** The `id` the mark-everything-read prompt answers to, which its trigger names in `commandfor`. */
const MARK_ALL_PROMPT_ID = "mark-all-read";

/** One line of copy the page says an action's outcome in, and the tone it wears. */
interface Note {
	key: string;
	/** Interpolation the copy reads, which is the count its plural form selects on. */
	options?: { count: number };
	color: "success" | "neutral";
}

/**
 * The copy and tone for the outcome a mark-everything-read redirect carries, or `null`
 * when this is an ordinary visit. Only a run of decimal digits is a count, so a parameter
 * somebody typed by hand reports nothing rather than a number read out of it.
 *
 * @param marked - The redirect's `marked` parameter, as it arrived.
 */
function markNote(marked: string | null): Note | null {
	if (marked === null || !/^\d+$/.test(marked)) return null;

	let count = Number(marked);
	if (count === 0) return { key: "timeline.nothingToMark", color: "neutral" };
	return { key: "timeline.markedRead", options: { count }, color: "success" };
}

/** GET /reading — the unread queue. */
export default createAction(routes.reading, {
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

		let page = await store.readingQueue({ cursor });

		/**
		 * A cursor the store no longer decodes leaves the reader holding a place that is
		 * gone, so the newest page is shown with a note saying where they landed.
		 */
		let isStaleCursor = !page.ok;
		if (!page.ok) page = await store.readingQueue({ cursor: null });
		if (!page.ok) throw new Error("The first page of a timeline decodes without a cursor");

		let items = page.items;

		/** The queue gathers every feed, so a row names the one its post came from. */
		let entries = timelineEntries(
			ctx,
			items,
			new Map(page.feeds.map((feed) => [feed.id, feed.title])),
		);

		/**
		 * An empty queue reads two ways and only the feed list tells them apart: somebody
		 * following nothing is invited to start, and somebody following feeds has read them.
		 */
		let hasFeeds = items.length === 0 ? (await store.countFeeds()) > 0 : true;

		let note = markNote(ctx.url.searchParams.get(MARKED_PARAM));

		return ctx.render(
			<AppLayout
				documentTitle={ctx.i18next.t("reading.title")}
				heading={ctx.i18next.t("reading.heading")}
				/**
				 * On the queue's own line, acting on what the heading names and staying in reach
				 * however far down the list a reader has read. It has that row to itself, so a hand
				 * going for a post's own mark or for the older-posts link lands nowhere near it.
				 *
				 * A queue with nothing in it has nothing to clear, so the offer waits for posts.
				 */
				headingActions={
					entries.length > 0 ? (
						<Button
							commandfor={MARK_ALL_PROMPT_ID}
							command="show-modal"
							color="danger"
							variant="ghost"
							size="sm"
						>
							{ctx.i18next.t("timeline.markAllRead.submit")}
						</Button>
					) : undefined
				}
				current="reading"
				locale={ctx.locale}
				nav={{
					label: ctx.i18next.t("nav.label"),
					reading: ctx.i18next.t("nav.reading"),
					feeds: ctx.i18next.t("nav.feeds"),
					search: ctx.i18next.t("nav.search"),
					settings: ctx.i18next.t("nav.settings"),
					logout: ctx.i18next.t("nav.logout"),
				}}
			>
				<div mix={[vstack({ gap: 6 })]}>
					{/**
					 * The warning the reader reads before the queue goes, kept off the page itself: the
					 * prompt is a native `dialog` the trigger opens through Invoker Commands, so the
					 * sentence costs nothing until it is the thing being decided. One sweep takes every
					 * unread post and nothing here records which they were, so the prompt is the whole
					 * of the undo this offers.
					 *
					 * Level 2, since the layout's own page heading is the document's only `h1`.
					 *
					 * The route answers `POST`, which is what a browser form sends, so the confirmation
					 * submits its own method and carries no override field.
					 */}
					{entries.length > 0 && (
						<HeadingScope level={2}>
							<Confirm
								id={MARK_ALL_PROMPT_ID}
								title={ctx.i18next.t("timeline.markAllRead.title")}
								description={ctx.i18next.t("timeline.markAllRead.confirm")}
								confirmLabel={ctx.i18next.t("timeline.markAllRead.submit")}
								cancelLabel={ctx.i18next.t("timeline.markAllRead.cancel")}
								form={{ action: routes.readAll.href() }}
							/>
						</HeadingScope>
					)}

					{note && (
						<Alert color={note.color}>
							<Alert.Description>{ctx.i18next.t(note.key, note.options)}</Alert.Description>
						</Alert>
					)}

					{isStaleCursor && (
						<Alert color="warning">
							<Alert.Description>{ctx.i18next.t("timeline.badCursor")}</Alert.Description>
							<Alert.Action>
								<LinkButton
									href={routes.reading.href()}
									color="neutral"
									variant="outline"
									size="sm"
								>
									{ctx.i18next.t("timeline.restart")}
								</LinkButton>
							</Alert.Action>
						</Alert>
					)}

					{entries.length > 0 ? (
						<Timeline
							entries={entries}
							/** The queue holds what is left to read, so the mark carries a post out of it. */
							readAction="complete"
							copy={{
								markRead: ctx.i18next.t("timeline.markRead"),
								markUnread: ctx.i18next.t("timeline.markUnread"),
								read: ctx.i18next.t("timeline.read"),
								newer: ctx.i18next.t("timeline.newer"),
								older: ctx.i18next.t("timeline.older"),
							}}
							returnTo={ctx.url.pathname + ctx.url.search}
							cursors={{
								next: queuePage(page.cursors.next),
								prev: queuePage(page.cursors.prev),
							}}
						/>
					) : (
						/** Level 2, since the layout's own page heading is the document's only `h1`. */
						<HeadingScope level={2}>
							{hasFeeds ? (
								<Empty>
									<Empty.Title>{ctx.i18next.t("reading.caughtUp.title")}</Empty.Title>
									<Empty.Description>
										{ctx.i18next.t("reading.caughtUp.description")}
									</Empty.Description>
								</Empty>
							) : (
								<Empty>
									<Empty.Title>{ctx.i18next.t("reading.noFeeds.title")}</Empty.Title>
									<Empty.Description>
										{ctx.i18next.t("reading.noFeeds.description")}
									</Empty.Description>
									<Empty.Action>
										<LinkButton href={routes.feeds.index.href()} size="sm">
											{ctx.i18next.t("reading.noFeeds.cta")}
										</LinkButton>
									</Empty.Action>
								</Empty>
							)}
						</HeadingScope>
					)}
				</div>
			</AppLayout>,
		);
	},
});
