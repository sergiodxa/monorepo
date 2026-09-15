/**
 * Reading-queue controller for `GET /reading`: the posts of every followed feed, newest
 * first, and the app's landing spot after sign-in. It is the app's only list of posts, and
 * the header's own controls are what narrow it — to what is read or unread, to the words
 * a reader searched for, or to both at once, which is the pairing a page of its own for
 * each could never offer.
 *
 * The header also carries the two things a reader does to their subscriptions as a whole:
 * checking every feed on the spot, and following another one. The subscriptions themselves
 * are in the sidebar beside this, which is what leaves this surface the posts.
 *
 * Both narrowings ride in the URL, so a queue is a link a reader can keep, share and
 * reload rather than a state the page forgets.
 *
 * The store answers with posts and, beside them, the feeds those posts came from. Turning
 * that into the row a reader sees happens here, where the dictionary and the request's
 * language are, so the list itself prints text it is handed.
 *
 * The page is exported because a refused follow is answered with the page it was submitted
 * from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@sdxc/i18n";
import type { Renderer } from "remix/middleware/render";
import type { RemixNode } from "remix/ui";

import { CheckCheckIcon, RefreshCwIcon } from "@sdxc/icons";
import { parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { boxSizing, flex, gap, grow, items, vstack } from "@sdxc/u/layout";
import { bs, is, maxIs, minIs, p } from "@sdxc/u/size";
import { Alert, Button, Confirm, Empty, HeadingScope, LinkButton } from "@sdxc/ui";
import { createAction } from "remix/router";
import { attrs } from "remix/ui";

import type { QueueView } from "~/app/http/controllers/queue-view";
import type { UserStore } from "~/database/user-do";

import { chrome } from "~/app/http/controllers/chrome";
import { FAILED_PARAM, FRESH_PARAM, SWEPT_PARAM } from "~/app/http/controllers/feeds/refresh-all";
import {
	FROM_PARAM,
	QueueFields,
	queueUrl,
	readQueueView,
} from "~/app/http/controllers/queue-view";
import { MARKED_PARAM } from "~/app/http/controllers/read-all";
import { timelineEntries } from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { FRAME_PARAM, isFrameRequest } from "~/app/http/render";
import { userStore } from "~/database/user-do";
import AppLayout, {
	ActionLabel,
	AppNavLink,
	BAND_FIELD_HEIGHT,
	pageNote,
} from "~/resources/layouts/app";
import Timeline from "~/resources/views/timeline";
import routes from "~/routes/web";

/** The filters offered, in the order their links are read. */
const READ_STATES: UserStore.ReadState[] = ["all", "unread", "read"];

/**
 * How many posts one page of the queue holds. The reader walks the queue a page at a time
 * and, wherever their browser runs the enhancement below, the next page arrives under them
 * as they scroll — so a page is sized to arrive rather than to be complete.
 */
const PAGE_SIZE = 25;

/** The `id` the mark-everything-read prompt answers to, which its trigger names in `commandfor`. */
const MARK_ALL_PROMPT_ID = "mark-all-read";

/** The `id` the follow form answers to, tying its field and its refusal to one submission. */
const FOLLOW_FORM_ID = "follow-feed";

/** Ties the follow field to the note a refusal is reported in, and to the label naming it. */
const FOLLOW_FIELD_ID = "follow-feed-url";

/** The `id` the refusal's own note answers to, which the field points at while it stands. */
const FOLLOW_ERROR_ID = "follow-feed-error";

/** Edge of the marks the header's own controls are drawn with, sized to the words beside them. */
const ACTION_ICON_SIZE = 16;

/**
 * Width the follow field will not be squeezed past. It is the last thing on the row and so
 * the first a flexible row would take width from, and a field two centimetres wide is one
 * nobody can read an address in; below this the row wraps and gives it a line of its own.
 */
const FOLLOW_FIELD_FLOOR = "12rem";

/** Width it stops growing at, since an address needs no more of a wide window than this. */
const FOLLOW_FIELD_CAP = "20rem";

/** One line of copy the page says an action's outcome in, and the tone it wears. */
interface Note {
	message: string;
	color: "success" | "warning" | "neutral";
}

/**
 * What an empty queue has to say, which is a different sentence under each way of
 * narrowing it. A reader is told what came back empty rather than that something did: the
 * words they searched for, the state they filtered to, or the queue itself.
 *
 * @param i18next - The request's dictionary.
 * @param view - How the queue was narrowed and came back without a post.
 */
function emptyCopy(i18next: i18n, view: QueueView) {
	if (view.query.trim().length > 0) {
		if (view.readState === "unread") {
			return {
				title: i18next.t("reading.found.unread.title"),
				description: i18next.t("reading.found.unread.description"),
			};
		}

		if (view.readState === "read") {
			return {
				title: i18next.t("reading.found.read.title"),
				description: i18next.t("reading.found.read.description"),
			};
		}

		return {
			title: i18next.t("reading.found.all.title"),
			description: i18next.t("reading.found.all.description"),
		};
	}

	if (view.readState === "unread") {
		return {
			title: i18next.t("reading.empty.unread.title"),
			description: i18next.t("reading.empty.unread.description"),
		};
	}

	if (view.readState === "read") {
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

/**
 * Where this page's first row falls in the list as a whole, or `null` for a page that
 * cannot say. The newest page starts at the first row; a page below it is told where it
 * begins by the page that linked to it; and a cursor followed on its own says nothing
 * about how far in it is, so such a page counts from one the way any other list does.
 *
 * @param params - The query the page was asked for with.
 * @param isStaleCursor - Whether the cursor was refused, leaving this the newest page.
 */
function startFrom(params: URLSearchParams, isStaleCursor: boolean): number | null {
	if (isStaleCursor || params.get("cursor") === null) return 1;

	let from = params.get(FROM_PARAM);
	if (from === null || !/^\d+$/.test(from)) return null;

	let position = Number.parseInt(from, 10);
	return position > 0 ? position : null;
}

/** The word one filter's link is read as. */
function filterLabel(i18next: i18n, readState: UserStore.ReadState): string {
	if (readState === "unread") return i18next.t("reading.filter.unread");
	if (readState === "read") return i18next.t("reading.filter.read");
	return i18next.t("reading.filter.all");
}

/**
 * One count off a redirect, or `null` for a parameter that is absent or is something other
 * than a count, so a URL arrived at by hand reports nothing rather than a number read out
 * of it.
 *
 * @param params - The query the page was asked for with.
 * @param name - The parameter holding the count.
 */
function reportedCount(params: URLSearchParams, name: string): number | null {
	let raw = params.get(name);
	if (raw === null || !/^\d+$/.test(raw)) return null;
	return Number.parseInt(raw, 10);
}

/**
 * The copy and tone for the outcome a mark-everything-read redirect carries, or `null`
 * when this is an ordinary visit.
 *
 * @param i18next - The request's dictionary.
 * @param params - The query the page was asked for with.
 */
function markNote(i18next: i18n, params: URLSearchParams): Note | null {
	let count = reportedCount(params, MARKED_PARAM);
	if (count === null) return null;

	if (count === 0) return { message: i18next.t("timeline.nothingToMark"), color: "neutral" };
	return { message: i18next.t("timeline.markedRead", { count }), color: "success" };
}

/**
 * The copy and tone for the outcome a check-every-feed redirect carries, or `null` when
 * this is an ordinary visit. The sentences read in the order a reader asks the questions
 * in: how many were reached, what came back, and what did not answer.
 *
 * A sweep that left some feeds unreached is a warning rather than a failure, the same tone
 * a single feed's failed check earns, since the feeds that did answer are current.
 *
 * @param i18next - The request's dictionary.
 * @param params - The query the page was asked for with.
 */
function checkAllNote(i18next: i18n, params: URLSearchParams): Note | null {
	let swept = reportedCount(params, SWEPT_PARAM);
	if (swept === null) return null;

	let fresh = reportedCount(params, FRESH_PARAM) ?? 0;
	let failed = reportedCount(params, FAILED_PARAM) ?? 0;

	let sentences = [
		i18next.t("feeds.checkAll.done", { count: swept }),
		fresh > 0
			? i18next.t("feeds.checkAll.newPosts", { count: fresh })
			: i18next.t("feeds.checkAll.nothingNew"),
	];

	if (failed > 0) sentences.push(i18next.t("feeds.checkAll.failed", { count: failed }));

	return { message: sentences.join(" "), color: failed > 0 ? "warning" : "success" };
}

export namespace ReadingQueue {
	/**
	 * What the page needs off the request. Narrower than the full `RequestContext` so the
	 * follow action, which renders this page from its own handler, hands over exactly the
	 * renderer, dictionary, language and query the page reads.
	 */
	export interface Context {
		render: Renderer<RemixNode>;
		i18next: i18n;
		locale: string;
		/** The URL asked for, whose query carries what a completed action has to report. */
		url: URL;
		/**
		 * The request itself, which says whether a whole page was asked for or the fragment
		 * continuing one already on screen.
		 */
		request: Request;
	}

	/** What the follow form has to say when the page is rendered. */
	export interface Submission {
		/** The translated refusal reported above the list, or `null` for a fresh form. */
		error: string | null;
		/** The submitted address, put back so a typo is corrected rather than retyped. */
		value: string | null;
	}
}

/**
 * Renders the reading queue: the chrome, the header's controls, and one page of the posts
 * the narrowing asks for.
 *
 * Every label is resolved here, because the views print the strings they are handed and
 * the dictionary belongs with the request that detected the language.
 *
 * @param ctx - The request's renderer, dictionary, language and query.
 * @param view - How the queue is narrowed, which the header's controls all carry.
 * @param cursor - The page of the queue to show, or `null` for the newest.
 * @param submission - The refusal to report, and the address to put back in the field.
 * @param init - Response status and headers; omit for the plain `200` the queue is served with.
 * @example return renderReadingQueue(ctx, view, null, { error: null, value: null });
 */
export async function renderReadingQueue(
	ctx: ReadingQueue.Context,
	view: QueueView,
	cursor: string | null,
	submission: ReadingQueue.Submission,
	init?: ResponseInit,
) {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this page renders");

	let store = userStore(viewer.id);

	let page = await store.readingQueue({
		cursor,
		readState: view.readState,
		query: view.query,
		limit: PAGE_SIZE,
	});

	/**
	 * A cursor the store no longer decodes leaves the reader holding a place that is gone,
	 * so the newest page is shown with a note saying where they landed.
	 */
	let isStaleCursor = !page.ok;
	if (!page.ok) {
		page = await store.readingQueue({
			cursor: null,
			readState: view.readState,
			query: view.query,
			limit: PAGE_SIZE,
		});
	}
	if (!page.ok) throw new Error("The first page of a timeline decodes without a cursor");

	/** The queue gathers every feed, so a row names the one its post came from. */
	let entries = timelineEntries(
		ctx,
		page.items,
		new Map(page.feeds.map((feed) => [feed.id, feed.title])),
	);

	/**
	 * An empty queue reads one way for somebody following nothing, who is invited to start,
	 * and another for somebody whose feeds hold no post the narrowing asks for.
	 */
	let hasFeeds = entries.length === 0 ? (await store.countFeeds()) > 0 : true;

	let hasQuery = view.query.trim().length > 0;

	let heading = hasQuery
		? ctx.i18next.t("reading.headingFor", { query: view.query })
		: ctx.i18next.t("reading.heading");

	let empty = emptyCopy(ctx.i18next, view);

	/** The narrowing alone, which is where the newest page of it lives. */
	let here = queueUrl(view);

	/**
	 * The page being read, which a row's own mark returns to: a reader who marks a post on
	 * the third page of their queue is put back on the third page of it.
	 */
	let returnTo = queueUrl(view, isStaleCursor ? null : cursor);

	/**
	 * Where this page's first row falls in the list, and where the next page's first row
	 * will: each page counts its own rows on and hands the total to the one below, so the
	 * numbering is carried by the pages actually walked rather than guessed from a cursor.
	 */
	let start = startFrom(ctx.url.searchParams, isStaleCursor);

	/**
	 * This page's own address, which the reader's browser carries while they are reading it.
	 * The newest page is the plain address: a reader at the top of their queue is looking at
	 * the queue rather than at a place inside it.
	 */
	let pageUrl =
		cursor === null || isStaleCursor
			? here
			: queueUrl(view, cursor, start === null ? {} : { [FROM_PARAM]: String(start) });

	/** What the page below this one is told about where it begins, when this page can say. */
	let below: Record<string, string> =
		start === null ? {} : { [FROM_PARAM]: String(start + entries.length) };

	let older = page.cursors.next === null ? null : queueUrl(view, page.cursors.next, below);

	/** The same page, asked for as the piece that continues this one rather than as a page. */
	let continueSrc =
		page.cursors.next === null
			? null
			: queueUrl(view, page.cursors.next, { ...below, [FRAME_PARAM]: "1" });

	/** The copy every row of the list prints, whichever shape this page is answered in. */
	let listCopy = {
		markRead: ctx.i18next.t("timeline.markRead"),
		markUnread: ctx.i18next.t("timeline.markUnread"),
		read: ctx.i18next.t("timeline.read"),
		newer: ctx.i18next.t("timeline.newer"),
		older: ctx.i18next.t("timeline.older"),
		end: ctx.i18next.t("timeline.end"),
	};

	/**
	 * A frame asked for the piece that continues a queue already on screen, so it is
	 * answered with that piece: the rows, numbered on from where the page above stopped,
	 * and whatever carries the reader on from the end of them. The chrome, the heading and
	 * the header's controls are all already in the document this is written into.
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
						<LinkButton href={here} color="neutral" variant="outline" size="sm">
							{ctx.i18next.t("timeline.restart")}
						</LinkButton>
					</Alert.Action>
				</Alert>
			) : (
				<Timeline
					entries={entries}
					start={start}
					continueSrc={continueSrc}
					pageUrl={pageUrl}
					copy={listCopy}
					returnTo={returnTo}
					cursors={{ next: older, prev: null }}
				/>
			),
			init,
		);
	}

	/**
	 * The chrome is drawn for the queue as it is narrowed rather than for the address this
	 * request arrived at, so a refused follow — which posts to the subscriptions — still
	 * marks the queue as the place being read and puts the search back in the box.
	 */
	let chromeProps = await chrome({
		i18next: ctx.i18next,
		locale: ctx.locale,
		url: new URL(here, ctx.url),
	});

	/**
	 * One action redirects here at a time, each carrying its own parameters and no other, so
	 * the page has one outcome to report and one line to report it in. A URL arriving with
	 * both was assembled by hand, and the marking is the one that moved posts, so it speaks.
	 */
	let outcome =
		markNote(ctx.i18next, ctx.url.searchParams) ?? checkAllNote(ctx.i18next, ctx.url.searchParams);

	return ctx.render(
		<AppLayout
			documentTitle={heading}
			heading={heading}
			/**
			 * On the queue's own line, acting on what the heading names and staying in reach
			 * however far down the list a reader has read. They have that row to themselves, so
			 * a hand going for a post's own mark or for the older-posts link lands nowhere near
			 * them.
			 *
			 * The filters lead, since choosing which posts the page holds comes before acting on
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
								/** The words carry across a filter, so narrowing one never drops the other. */
								href={queueUrl({ ...view, readState: state })}
								label={filterLabel(ctx.i18next, state)}
								isCurrent={state === view.readState}
							/>
						))}
					</nav>

					{/**
					 * A `POST` rather than a link: a sweep retrieves every origin the reader follows,
					 * and a prefetcher or a mail scanner walks links of its own accord.
					 */}
					<form method="post" action={routes.feeds.refreshAll.href()}>
						<QueueFields query={view.query} readState={view.readState} />

						<Button
							type="submit"
							color="neutral"
							variant="ghost"
							size="sm"
							aria-label={ctx.i18next.t("feeds.checkAll.submit")}
							title={ctx.i18next.t("feeds.checkAll.submit")}
						>
							{/** The arrows a page is fetched again with, which is what this asks for. */}
							<RefreshCwIcon size={ACTION_ICON_SIZE} />
							<ActionLabel>{ctx.i18next.t("feeds.checkAll.submit")}</ActionLabel>
						</Button>
					</form>

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

					{/**
					 * Following another feed belongs beside the list its posts will join, and needs
					 * one field to do it. The return key sends it, the way the sidebar's search box is
					 * sent, so nothing takes width from the row for a button saying what the field
					 * already says.
					 *
					 * Last on the row, where a field belongs among marks, and holding a width it will
					 * not be squeezed past: an address is typed into this, so the row wraps and gives
					 * it a line of its own before it shrinks to something nobody can read.
					 */}
					<form
						id={FOLLOW_FORM_ID}
						method="post"
						action={routes.feeds.follow.href()}
						mix={[
							flex(),
							items("center"),
							grow(),
							minIs(FOLLOW_FIELD_FLOOR),
							maxIs(FOLLOW_FIELD_CAP),
						]}
					>
						<QueueFields query={view.query} readState={view.readState} />

						<label htmlFor={FOLLOW_FIELD_ID} mix={[visuallyHidden()]}>
							{ctx.i18next.t("feeds.follow.label")}
						</label>

						<input
							id={FOLLOW_FIELD_ID}
							type="url"
							name="url"
							required
							autoComplete="url"
							placeholder={ctx.i18next.t("feeds.follow.placeholder")}
							defaultValue={submission.value ?? undefined}
							aria-invalid={submission.error === null ? undefined : "true"}
							aria-describedby={submission.error === null ? undefined : FOLLOW_ERROR_ID}
							mix={[
								is("full"),
								minIs(0),
								/** The height the app's top band is measured from, so it stands in it. */
								bs(BAND_FIELD_HEIGHT),
								boxSizing("border-box"),
								p(0, 3),
								rounded("lg"),
								border({ color: "neutral.border", width: 1 }),
								bg("neutral.bg"),
								fg("neutral.emphasis"),
								raw({ font: "inherit", fontSize: "0.875rem" }),
							]}
						/>
					</form>
				</>
			}
			locale={ctx.locale}
			{...chromeProps}
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
							form={{
								action: routes.readAll.href(),
								fields: <QueueFields query={view.query} readState={view.readState} />,
							}}
						/>
					</HeadingScope>
				)}

				{/**
				 * The refusal reports here, above the list, where this surface says what every
				 * other action did. The field it belongs to is one line up in the header with no
				 * room beneath it for a sentence, so the field points at this note by name and
				 * holds the address that was refused, and the two are read as one thing.
				 */}
				{submission.error && (
					<Alert id={FOLLOW_ERROR_ID} color="danger" mix={pageNote()}>
						<Alert.Description>{submission.error}</Alert.Description>
					</Alert>
				)}

				{outcome && (
					<Alert color={outcome.color} mix={pageNote()}>
						<Alert.Description>{outcome.message}</Alert.Description>
					</Alert>
				)}

				{isStaleCursor && (
					<Alert color="warning" mix={pageNote()}>
						<Alert.Description>{ctx.i18next.t("timeline.badCursor")}</Alert.Description>
						<Alert.Action>
							<LinkButton href={here} color="neutral" variant="outline" size="sm">
								{ctx.i18next.t("timeline.restart")}
							</LinkButton>
						</Alert.Action>
					</Alert>
				)}

				{entries.length > 0 ? (
					<Timeline
						entries={entries}
						start={start}
						continueSrc={continueSrc}
						pageUrl={pageUrl}
						copy={listCopy}
						returnTo={returnTo}
						cursors={{
							next: older,
							prev: page.cursors.prev === null ? null : queueUrl(view, page.cursors.prev),
						}}
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
							</Empty>
						)}
					</HeadingScope>
				)}
			</div>
		</AppLayout>,
		init,
	);
}

/** GET /reading — every post, narrowed by whatever the header's controls are set to. */
export default createAction(routes.reading, {
	middleware: [requireUser],
	async handler(ctx) {
		/**
		 * A malformed paging parameter falls back to the newest page, which is what this URL
		 * shows without one, rather than to an error page the reader can do nothing about.
		 */
		let params = parsePageParams(ctx.url.searchParams);
		let cursor = isFailure(params) ? null : params.data.cursor;

		return await renderReadingQueue(ctx, readQueueView(ctx.url.searchParams), cursor, {
			error: null,
			value: null,
		});
	},
});
