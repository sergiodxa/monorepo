/**
 * Reading-queue controller for `GET /reading`: the posts of every followed feed, newest
 * first, and the app's landing spot after sign-in. It holds read and unread posts alike,
 * and the row of links beside the heading narrows it to one or the other. On that same
 * line sits the way to clear the whole of it at once, for a reader far enough behind that
 * starting fresh beats working through the backlog.
 *
 * Which posts the page holds rides in the `show` parameter, so a narrowed queue is a URL
 * a reader can keep, share and reload rather than a state the page forgets. The word says
 * what the page holds rather than how it was narrowed, and reads as a sentence with its
 * value: `show=unread`. Showing everything is what this page does unasked, so that view
 * is the plain address with no parameter on it at all, and a value nobody wrote — a typo,
 * an old link — lands there too rather than on an error a reader can do nothing about.
 *
 * The store answers with posts and, beside them, the feeds those posts came from. Turning
 * that into the row a reader sees happens here, where the dictionary and the request's
 * language are, so the list itself prints text it is handed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@sdxc/i18n";

import { CheckCheckIcon } from "@sdxc/icons";
import { parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { flex, gap, items, vstack } from "@sdxc/u/layout";
import { Alert, Button, Confirm, Empty, HeadingScope, LinkButton } from "@sdxc/ui";
import { createAction } from "remix/router";
import { attrs } from "remix/ui";

import type { UserStore } from "~/database/user-do";

import { chrome } from "~/app/http/controllers/chrome";
import { MARKED_PARAM } from "~/app/http/controllers/read-all";
import { timelineEntries } from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import ScrollPaging from "~/resources/components/scroll-paging";
import AppLayout, { ActionLabel, AppNavLink, pageNote } from "~/resources/layouts/app";
import Timeline from "~/resources/views/timeline";
import routes from "~/routes/web";

/** The parameter naming which of the queue's posts the page holds. */
const SHOW_PARAM = "show";

/** What the queue holds when the URL asks for nothing in particular. */
const DEFAULT_READ_STATE: UserStore.ReadState = "all";

/** The filters offered, in the order their links are read. */
const READ_STATES: UserStore.ReadState[] = ["all", "unread", "read"];

/**
 * How many posts one page of the queue holds. The reader walks the queue a page at a time
 * and, wherever their browser runs the enhancement below, the next page arrives under them
 * as they scroll — so a page is sized to arrive rather than to be complete.
 */
const PAGE_SIZE = 25;

/** The `id` the list answers to, which the paging enhancement appends its pages into. */
const QUEUE_LIST_ID = "reading-queue";

/**
 * Which posts the URL is asking for. Anything other than the two narrower views is every
 * post, which is what this page shows on its own.
 *
 * @param show - The `show` parameter, as it arrived.
 */
function readStateFrom(show: string | null): UserStore.ReadState {
	if (show === "unread" || show === "read") return show;
	return DEFAULT_READ_STATE;
}

/**
 * The URL of the queue narrowed to one filter, which is what the filter links carry. The
 * page holding every post is the plain address, so the URL a reader arrives on and the one
 * the first filter link points at are the same.
 *
 * @param readState - Which posts the page would hold.
 */
function queueFilter(readState: UserStore.ReadState): string {
	if (readState === DEFAULT_READ_STATE) return routes.reading.href();
	return `${routes.reading.href()}?${new URLSearchParams({ [SHOW_PARAM]: readState })}`;
}

/**
 * The URL of one page of the queue, which is what the timeline's older and newer links
 * carry: the cursor alone would resolve against whatever page the browser is on, and would
 * take the reader out of the filter they are reading in.
 *
 * @param cursor - The boundary the store minted, or `null` at either end of the queue.
 * @param readState - Which posts the page holds, carried along so paging stays inside it.
 */
function queuePage(cursor: string | null, readState: UserStore.ReadState): string | null {
	if (cursor === null) return null;

	let params = new URLSearchParams({ cursor });
	if (readState !== DEFAULT_READ_STATE) params.set(SHOW_PARAM, readState);

	return `${routes.reading.href()}?${params}`;
}

/**
 * What an empty queue has to say, which is a different sentence under each filter: nothing
 * published yet, nothing left to read, and nothing read so far are three pieces of news.
 *
 * @param i18next - The request's dictionary.
 * @param readState - Which posts the page was asked for and came back without.
 */
function emptyCopy(i18next: i18n, readState: UserStore.ReadState) {
	if (readState === "unread") {
		return {
			title: i18next.t("reading.empty.unread.title"),
			description: i18next.t("reading.empty.unread.description"),
		};
	}

	if (readState === "read") {
		return {
			title: i18next.t("reading.empty.read.title"),
			description: i18next.t("reading.empty.read.description"),
		};
	}

	return {
		title: i18next.t("reading.empty.all.title"),
		description: i18next.t("reading.empty.all.description"),
	};
}

/** The word one filter's link is read as. */
function filterLabel(i18next: i18n, readState: UserStore.ReadState): string {
	if (readState === "unread") return i18next.t("reading.filter.unread");
	if (readState === "read") return i18next.t("reading.filter.read");
	return i18next.t("reading.filter.all");
}

/** Edge of the marks the header's own controls are drawn with, sized to the words beside them. */
const ACTION_ICON_SIZE = 16;

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

/** GET /reading — the reading queue, whole or narrowed to what is read or unread. */
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

		let readState = readStateFrom(ctx.url.searchParams.get(SHOW_PARAM));

		let page = await store.readingQueue({ cursor, readState, limit: PAGE_SIZE });

		/**
		 * A cursor the store no longer decodes leaves the reader holding a place that is
		 * gone, so the newest page is shown with a note saying where they landed.
		 */
		let isStaleCursor = !page.ok;
		if (!page.ok) page = await store.readingQueue({ cursor: null, readState, limit: PAGE_SIZE });
		if (!page.ok) throw new Error("The first page of a timeline decodes without a cursor");

		let posts = page.items;

		/** The queue gathers every feed, so a row names the one its post came from. */
		let entries = timelineEntries(
			ctx,
			posts,
			new Map(page.feeds.map((feed) => [feed.id, feed.title])),
		);

		/**
		 * An empty queue reads one way for somebody following nothing, who is invited to
		 * start, and another for somebody whose feeds hold no post the filter asks for.
		 */
		let hasFeeds = posts.length === 0 ? (await store.countFeeds()) > 0 : true;

		let note = markNote(ctx.url.searchParams.get(MARKED_PARAM));

		let empty = emptyCopy(ctx.i18next, readState);
		let older = queuePage(page.cursors.next, readState);

		return ctx.render(
			<AppLayout
				documentTitle={ctx.i18next.t("reading.title")}
				heading={ctx.i18next.t("reading.heading")}
				/**
				 * On the queue's own line, acting on what the heading names and staying in reach
				 * however far down the list a reader has read. They have that row to themselves, so
				 * a hand going for a post's own mark or for the older-posts link lands nowhere near
				 * them.
				 *
				 * The filters lead, since choosing which posts the page holds comes before clearing
				 * them; a queue with nothing in it has nothing to clear, so that offer waits for
				 * posts while the filters stay, which is how a reader leaves an empty view.
				 */
				actions={
					<>
						<nav
							aria-label={ctx.i18next.t("reading.filter.label")}
							mix={[flex(), items("center"), gap(3)]}
						>
							{READ_STATES.map((state) => (
								<AppNavLink
									key={state}
									href={queueFilter(state)}
									label={filterLabel(ctx.i18next, state)}
									isCurrent={state === readState}
								/>
							))}
						</nav>

						{entries.length > 0 && (
							<Button
								/**
								 * The app's own colour rather than the warning one: a sweep takes nothing
								 * away. Every post it touches is still here and the read filter beside this
								 * is where they are found, so the red is left for unfollowing, which does
								 * delete what it names.
								 */
								commandfor={MARK_ALL_PROMPT_ID}
								command="show-modal"
								color="brand"
								variant="ghost"
								size="sm"
								aria-label={ctx.i18next.t("timeline.markAllRead.submit")}
								title={ctx.i18next.t("timeline.markAllRead.submit")}
							>
								{/**
								 * A second tick for the second reach: a row's own mark ticks one post and
								 * this ticks every post the queue holds.
								 */}
								<CheckCheckIcon size={ACTION_ICON_SIZE} />
								<ActionLabel>{ctx.i18next.t("timeline.markAllRead.submit")}</ActionLabel>
							</Button>
						)}
					</>
				}
				locale={ctx.locale}
				{...await chrome(ctx)}
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
								color="brand"
								/**
								 * The sweep is left to the browser to navigate, so the page it answers with
								 * arrives as a new document and this prompt goes with the old one. A patched
								 * page keeps the state a reader owns — an open `dialog`, a typed-in field —
								 * which is the right call nearly everywhere and the wrong one for a prompt
								 * whose whole purpose is to be finished with.
								 */
								parts={{ form: [attrs({ "data-rmx-document": "" })] }}
								title={ctx.i18next.t("timeline.markAllRead.title")}
								description={ctx.i18next.t("timeline.markAllRead.confirm")}
								confirmLabel={ctx.i18next.t("timeline.markAllRead.submit")}
								cancelLabel={ctx.i18next.t("timeline.markAllRead.cancel")}
								form={{ action: routes.readAll.href() }}
							/>
						</HeadingScope>
					)}

					{note && (
						<Alert color={note.color} mix={pageNote()}>
							<Alert.Description>{ctx.i18next.t(note.key, note.options)}</Alert.Description>
						</Alert>
					)}

					{isStaleCursor && (
						<Alert color="warning" mix={pageNote()}>
							<Alert.Description>{ctx.i18next.t("timeline.badCursor")}</Alert.Description>
							<Alert.Action>
								<LinkButton
									href={queueFilter(readState)}
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
							listId={QUEUE_LIST_ID}
							copy={{
								markRead: ctx.i18next.t("timeline.markRead"),
								markUnread: ctx.i18next.t("timeline.markUnread"),
								read: ctx.i18next.t("timeline.read"),
								newer: ctx.i18next.t("timeline.newer"),
								older: ctx.i18next.t("timeline.older"),
							}}
							returnTo={ctx.url.pathname + ctx.url.search}
							cursors={{ next: older, prev: queuePage(page.cursors.prev, readState) }}
						/>
					) : (
						/** Level 2, since the layout's own page heading is the document's only `h1`. */
						<HeadingScope level={2}>
							{hasFeeds ? (
								<Empty>
									<Empty.Title>{empty.title}</Empty.Title>
									<Empty.Description>{empty.description}</Empty.Description>
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

					{/**
					 * The queue is the one surface long enough to be read by scrolling, so it is the
					 * one that fetches its next page as the reader reaches the end of this one. The
					 * older-posts link above is rendered and sent either way, and is what a reader
					 * whose browser never runs this walks the queue with.
					 */}
					{older && (
						<ScrollPaging
							listId={QUEUE_LIST_ID}
							next={older}
							loadingLabel={ctx.i18next.t("reading.paging.loading")}
							failedLabel={ctx.i18next.t("reading.paging.failed")}
							retryLabel={ctx.i18next.t("reading.paging.retry")}
							endLabel={ctx.i18next.t("reading.paging.end")}
						/>
					)}
				</div>
			</AppLayout>,
		);
	},
});
