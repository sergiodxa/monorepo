/**
 * Single-feed controller for `GET /reading/:feed`: one feed's posts, read and unread
 * alike, newest first, headed by the feed's name — which is the link to the site behind
 * it — and, on that same line, the ways to act on the feed as a whole: check it now, take
 * its unread posts out of the queue, and stop following it.
 *
 * It sits under the queue because it is the same list narrowed to one publisher. What that
 * publisher says about itself and how its last checks went are here too: a reader looks at
 * a feed's health while they are looking at the feed.
 *
 * The feed is looked up in the reader's own storage, so a feed somebody else follows is
 * as absent here as one nobody does, and both answer `404`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CircleCheckIcon, RefreshCwIcon, UnlinkIcon } from "@sdxc/icons";
import { parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { flex, flexWrap, gap, items, vstack } from "@sdxc/u/layout";
import { maxIs } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Alert, Badge, Button, Confirm, Empty, HeadingScope, LinkButton, Text } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";
import { attrs } from "remix/ui";

import type { FeedStatus } from "~/database/schema";

import { chrome } from "~/app/http/controllers/chrome";
import { MARKED_PARAM } from "~/app/http/controllers/feeds/read";
import { CHECKED_PARAM } from "~/app/http/controllers/feeds/refresh";
import { placePage } from "~/app/http/controllers/list-paging";
import { exactDate, shortDate, timelineEntries } from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { isFrameRequest } from "~/app/http/render";
import { userStore } from "~/database/user-do";
import AppLayout, { ActionLabel, PAGE_COLUMN, pageNote } from "~/resources/layouts/app";
import Timeline from "~/resources/views/timeline";
import routes from "~/routes/web";

/**
 * The URL of one page of a feed, which is what the timeline's older and newer links carry:
 * the cursor alone would resolve against whatever page the browser is on.
 *
 * The feed rides in the path rather than in the query, and this surface narrows its posts
 * by nothing else, so a page of it is that path and a cursor.
 *
 * @param feedId - The feed being paged through.
 * @param cursor - The boundary the store minted, or `null` for the newest page.
 * @param extra - Parameters this page's address has to carry beyond the cursor.
 */
function feedUrl(
	feedId: string,
	cursor: string | null,
	extra: Record<string, string> = {},
): string {
	let params = new URLSearchParams();
	if (cursor !== null) params.set("cursor", cursor);
	for (let [name, value] of Object.entries(extra)) params.set(name, value);

	let base = routes.feed.href({ feed: feedId });
	let query = params.toString();
	return query.length === 0 ? base : `${base}?${query}`;
}

/**
 * The `id` the unfollow prompt answers to, which its trigger names in `commandfor`. It
 * carries the feed so the value is the page's alone.
 *
 * @param feedId - The feed the prompt would stop following.
 */
function unfollowPromptId(feedId: string): string {
	return `unfollow-${feedId}`;
}

/** One line of copy the page says an action's outcome in, and the tone it wears. */
interface Note {
	key: string;
	/** Interpolation the copy reads, which is the count its plural form selects on. */
	options?: { count: number };
	color: "success" | "warning" | "neutral";
}

/**
 * The copy and tone for the outcome a check-now redirect carries, or `null` when this is
 * an ordinary visit. `missing` needs no entry: a feed the reader does not follow renders
 * the not-found page above, which never reaches this.
 *
 * @param checked - The redirect's `checked` parameter, as it arrived.
 */
function checkNote(checked: string | null): Note | null {
	if (checked === "new") return { key: "feeds.check.new", color: "success" };
	if (checked === "none") return { key: "feeds.check.none", color: "success" };
	if (checked === "failed") return { key: "feeds.check.failed", color: "warning" };
	return null;
}

/**
 * The copy and tone for the outcome a mark-feed-read redirect carries, or `null` when
 * this is an ordinary visit. Only a run of decimal digits is a count, so a parameter
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

/** Edge of the marks the header's own controls are drawn with, sized to the words beside them. */
const ACTION_ICON_SIZE = 16;

/**
 * The `feeds.status.*` key naming each outcome that counts as a failed check. A refresh
 * that recorded `ok` or `not_modified` succeeded, and a success resets the failure count,
 * so those two outcomes leave a feed with nothing to report.
 */
const FAILURE_STATUS_KEYS: Partial<Record<FeedStatus, string>> = {
	http_error: "feeds.status.http_error",
	network_error: "feeds.status.network_error",
	parse_error: "feeds.status.parse_error",
};

/** GET /reading/:feed — one feed, its health and its posts. */
/**
 * How many posts one page of a feed holds, which is the number the queue shows too: the
 * two surfaces are the same list of the same rows, and a page is sized to arrive under a
 * reader scrolling rather than to be complete.
 */
const PAGE_SIZE = 25;

export default createAction(routes.feed, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { feed: feedId } = s.parse(s.object({ feed: s.string() }), ctx.params);
		let store = userStore(viewer.id);

		let feed = await store.getFeed(feedId);

		if (!feed) {
			return ctx.render(
				<AppLayout
					documentTitle={ctx.i18next.t("feeds.show.notFound.title")}
					heading={ctx.i18next.t("feeds.show.notFound.title")}
					locale={ctx.locale}
					{...await chrome(ctx)}
				>
					{/** Level 2, since the layout's own page heading is the document's only `h1`. */}
					<HeadingScope level={2}>
						<Empty>
							<Empty.Title>{ctx.i18next.t("feeds.show.notFound.title")}</Empty.Title>
							<Empty.Description>
								{ctx.i18next.t("feeds.show.notFound.description")}
							</Empty.Description>
							<Empty.Action>
								<LinkButton href={routes.reading.href()} size="sm">
									{ctx.i18next.t("feeds.show.notFound.back")}
								</LinkButton>
							</Empty.Action>
						</Empty>
					</HeadingScope>
				</AppLayout>,
				{ status: 404 },
			);
		}

		/**
		 * A malformed paging parameter falls back to the newest page, which is what this URL
		 * shows without one, rather than to an error page the reader can do nothing about.
		 */
		let params = parsePageParams(ctx.url.searchParams);
		let cursor = isFailure(params) ? null : params.data.cursor;

		let page = await store.feedTimeline(feedId, { cursor, limit: PAGE_SIZE });

		/**
		 * A cursor the store no longer decodes leaves the reader holding a place that is
		 * gone, so the newest page is shown with a note saying where they landed.
		 */
		let isStaleCursor = !page.ok;
		if (!page.ok) page = await store.feedTimeline(feedId, { cursor: null, limit: PAGE_SIZE });
		if (!page.ok) throw new Error("The first page of a timeline decodes without a cursor");

		/**
		 * Each action redirects here carrying its own parameter and no other, so the page has
		 * one outcome to report and one line to report it in. A URL arriving with both was
		 * assembled by hand, and the marking is the one that moved posts, so it speaks.
		 */
		let note =
			markNote(ctx.url.searchParams.get(MARKED_PARAM)) ??
			checkNote(ctx.url.searchParams.get(CHECKED_PARAM));

		/**
		 * The page is headed by the feed's own name, so naming it again on every row below
		 * says nothing; the author is what tells one of this feed's posts from another.
		 */
		let entries = timelineEntries(ctx, page.items, null);

		/**
		 * An author every post on the page shares is the feed's own name said again on every
		 * row, which the heading above them already says once. Dropping it gives a phone back
		 * a line per row, and gives the rest of them a column that means something: a name
		 * here now tells one post from another rather than repeating where they all came from.
		 *
		 * It is read off the page in hand, so a feed whose authors vary from one page to the
		 * next names them on the pages where they vary and not on the pages where they do not.
		 */
		let authors = new Set(entries.map((entry) => entry.source));
		if (authors.size === 1) for (let entry of entries) entry.source = null;

		/**
		 * Where this page sits in the feed and what the ways off both ends of it are, worked
		 * out by the same code the queue uses: the two surfaces hold different posts and page
		 * through them identically.
		 */
		let placement = placePage({
			address: (at, extra) => feedUrl(feedId, at, extra),
			params: ctx.url.searchParams,
			cursor,
			isStaleCursor,
			rows: entries.length,
			pageSize: PAGE_SIZE,
			cursors: page.cursors,
		});

		/** The copy every row of the list prints, whichever shape this page is answered in. */
		let listCopy = {
			markRead: ctx.i18next.t("timeline.markRead"),
			markUnread: ctx.i18next.t("timeline.markUnread"),
			markFailed: ctx.i18next.t("timeline.markFailed"),
			read: ctx.i18next.t("timeline.read"),
			newer: ctx.i18next.t("timeline.newer"),
			older: ctx.i18next.t("timeline.older"),
			end: ctx.i18next.t("timeline.end"),
		};

		/**
		 * A frame asked for the piece continuing a feed already on screen, so it is answered
		 * with that piece: the rows, numbered on from the page it continues, and whatever
		 * carries the reader on from the end it continues. The chrome, the feed's name and
		 * everything said about the feed are already in the document this is written into.
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
							<LinkButton
								href={routes.feed.href({ feed: feedId })}
								color="neutral"
								variant="outline"
								size="sm"
							>
								{ctx.i18next.t("timeline.restart")}
							</LinkButton>
						</Alert.Action>
					</Alert>
				) : (
					<Timeline entries={entries} copy={listCopy} {...placement} />
				),
			);
		}

		/**
		 * What the publisher says this feed is, and how the last checks of it went. A reader
		 * asks after a feed's health while they are looking at the feed, so it is read here
		 * rather than off a list of every feed they follow.
		 */
		let statusKey = feed.lastStatus ? FAILURE_STATUS_KEYS[feed.lastStatus] : undefined;

		let failureLabel =
			feed.failureCount > 0 && statusKey
				? ctx.i18next.t("feeds.show.failingBecause", {
						failures: ctx.i18next.t("feeds.show.failing", { count: feed.failureCount }),
						reason: ctx.i18next.t(statusKey),
					})
				: null;

		let checkedLabel =
			feed.lastFetchedAt === null
				? ctx.i18next.t("feeds.show.neverChecked")
				: ctx.i18next.t("feeds.show.checked", {
						date: shortDate(feed.lastFetchedAt, ctx.locale, Date.now()),
					});

		return ctx.render(
			<AppLayout
				documentTitle={feed.title}
				heading={feed.title}
				/**
				 * On the feed's own line, so acting on the whole feed costs a click rather than a
				 * scroll past every post it ever published.
				 */
				actions={
					<>
						{/**
						 * A `POST` rather than a link: checking a feed reaches out to its origin and
						 * writes what came back, which is not something a prefetcher should do by
						 * following a URL. The mark rides inside the form's own submit, so what a
						 * reader presses is still the button that sends it.
						 */}
						<form method="post" action={routes.feeds.refresh.href({ feedId })}>
							<Button
								type="submit"
								color="neutral"
								variant="ghost"
								size="sm"
								aria-label={ctx.i18next.t("feeds.check.submit")}
								title={ctx.i18next.t("feeds.check.submit")}
							>
								{/** The arrows a page is fetched again with, which is what this asks for. */}
								<RefreshCwIcon size={ACTION_ICON_SIZE} />
								<ActionLabel>{ctx.i18next.t("feeds.check.submit")}</ActionLabel>
							</Button>
						</form>

						{/**
						 * A `POST` rather than a link, for the reason the check is one: a prefetcher or
						 * a mail scanner follows a `GET`, and following this one would take a feed out of
						 * a reader's queue without them asking for it.
						 *
						 * It submits on the first click. The reach is a single feed, the page names which
						 * one, and every post it touches keeps its own way back to unread.
						 */}
						<form method="post" action={routes.feeds.read.href({ feedId })}>
							<Button
								type="submit"
								color="neutral"
								variant="ghost"
								size="sm"
								aria-label={ctx.i18next.t("timeline.markFeedRead")}
								title={ctx.i18next.t("timeline.markFeedRead")}
							>
								{/** The mark a row wears once it is read, here worn by the whole feed. */}
								<CircleCheckIcon size={ACTION_ICON_SIZE} />
								<ActionLabel>{ctx.i18next.t("timeline.markFeedRead")}</ActionLabel>
							</Button>
						</form>

						<Button
							commandfor={unfollowPromptId(feedId)}
							command="show-modal"
							color="danger"
							variant="ghost"
							size="sm"
							aria-label={ctx.i18next.t("feeds.unfollow.submit")}
							title={ctx.i18next.t("feeds.unfollow.submit")}
						>
							{/** The tie between this reader and the feed, drawn as the broken link it becomes. */}
							<UnlinkIcon size={ACTION_ICON_SIZE} />
							<ActionLabel>{ctx.i18next.t("feeds.unfollow.submit")}</ActionLabel>
						</Button>
					</>
				}
				/** The feed's name is the link to the site behind it, for a feed that names one. */
				headingLink={
					feed.siteUrl
						? { href: feed.siteUrl, label: ctx.i18next.t("feeds.show.visitSite") }
						: undefined
				}
				locale={ctx.locale}
				{...await chrome(ctx)}
			>
				<div mix={[vstack({ gap: 6 })]}>
					{/**
					 * The warning the reader has to read before the feed goes, kept off the page
					 * itself: the prompt is a native `dialog` the trigger opens through Invoker
					 * Commands, so the sentence costs nothing until it is the thing being decided.
					 *
					 * Level 2, since the layout's own page heading is the document's only `h1`.
					 *
					 * The confirmation posts `_method`, since a browser form sends `GET` and `POST`
					 * alone and `methodOverride()` reads the declared `DELETE` back out of it.
					 */}
					<HeadingScope level={2}>
						<Confirm
							id={unfollowPromptId(feedId)}
							/**
							 * Letting go of a feed is left to the browser to navigate, so the list it
							 * answers with arrives as a new document and this prompt goes with the old
							 * one. A patched page keeps the state a reader owns — an open `dialog`, a
							 * typed-in field — which is the right call nearly everywhere and the wrong
							 * one for a prompt whose whole purpose is to be finished with.
							 */
							parts={{ form: [attrs({ "data-rmx-document": "" })] }}
							title={ctx.i18next.t("feeds.unfollow.title")}
							description={ctx.i18next.t("feeds.unfollow.confirm", { title: feed.title })}
							confirmLabel={ctx.i18next.t("feeds.unfollow.submit")}
							cancelLabel={ctx.i18next.t("feeds.unfollow.cancel")}
							form={{
								action: routes.feeds.unfollow.href({ feedId }),
								fields: <input type="hidden" name="_method" value="DELETE" />,
							}}
						/>
					</HeadingScope>

					{/**
					 * Under the name it describes and above the posts it explains: what the feed says it
					 * is, when it was last looked at, and what the last looks recorded. A feed that is
					 * fine says only the first two, so a badge on this line means something is wrong.
					 */}
					<div mix={[vstack({ gap: 1 }), maxIs(PAGE_COLUMN)]}>
						{feed.description && <Text>{feed.description}</Text>}

						<div
							mix={[
								flex(),
								items("center"),
								flexWrap("wrap"),
								gap(2),
								text("xs"),
								fg("neutral.muted"),
							]}
						>
							{failureLabel && (
								<Badge color="danger" variant="secondary">
									{failureLabel}
								</Badge>
							)}

							<span
								title={
									feed.lastFetchedAt === null
										? undefined
										: exactDate(feed.lastFetchedAt, ctx.locale)
								}
							>
								{checkedLabel}
							</span>
						</div>
					</div>

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
									href={routes.feed.href({ feed: feedId })}
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
						<Timeline entries={entries} copy={listCopy} {...placement} />
					) : (
						/** Level 2, since the layout's own page heading is the document's only `h1`. */
						<HeadingScope level={2}>
							<Empty>
								<Empty.Title>{ctx.i18next.t("feeds.show.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("feeds.show.empty.description")}
								</Empty.Description>
							</Empty>
						</HeadingScope>
					)}
				</div>
			</AppLayout>,
		);
	},
});
