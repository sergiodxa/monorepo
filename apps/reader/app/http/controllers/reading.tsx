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
 * Opening the queue is also where a reader finds out how much they are missing. The store
 * compares each subscription's cursor against the head its feed published and hands back
 * that count with the page, so this says what is waiting in the same breath as it shows
 * what is here — and then fetches it behind the response, never in front of it. A reader
 * back after a month gets their timeline in one indexed seek and the feeds they are
 * missing over the seconds after it.
 *
 * The page is exported because a refused follow is answered with the page it was submitted
 * from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Client } from "@sdxc/flags";
import type { i18n } from "@sdxc/i18n";
import type { Renderer } from "remix/middleware/render";
import type { RemixNode } from "remix/ui";

import { redirect } from "@sdxc/http/response";
import { UnprocessableEntity } from "@sdxc/http/status-code";
import { BookmarkIcon, CheckCheckIcon, RefreshCwIcon } from "@sdxc/icons";
import { currentLog } from "@sdxc/logger";
import { parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { boxSizing, flex, flexWrap, gap, grow, items, vstack } from "@sdxc/u/layout";
import { bs, is, maxIs, minIs, p } from "@sdxc/u/size";
import { text, textDecoration, truncate } from "@sdxc/u/typography";
import { Alert, Button, Confirm, Empty, HeadingScope, LinkButton } from "@sdxc/ui";
import { waitUntil } from "cloudflare:workers";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createController } from "remix/router";
import { attrs } from "remix/ui";

import type { QueueView } from "~/app/http/controllers/queue-view";
import type { UserStore } from "~/database/user-do";

import { chrome, forgetRailFeeds } from "~/app/http/controllers/chrome";
import { FAILED_PARAM, FRESH_PARAM, SWEPT_PARAM } from "~/app/http/controllers/feeds/refresh-all";
import { placePage } from "~/app/http/controllers/list-paging";
import {
	QueueFields,
	queueUrl,
	queueViewOf,
	readQueueView,
	SHOW_PARAM,
} from "~/app/http/controllers/queue-view";
import { MARKED_PARAM } from "~/app/http/controllers/read-all";
import { NAME_FIELD, SAVED_PARAM } from "~/app/http/controllers/searches/save";
import {
	exactDate,
	keepingLinkParameters,
	timelineCopy,
	timelineEntries,
} from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { isFrameRequest } from "~/app/http/render";
import { features } from "~/app/lib/flags";
import { SAVED_SEARCH_LIMIT, SEARCH_NAME_LENGTH } from "~/database/schema";
import { userStore } from "~/database/user-do";
import AppLayout, {
	ActionLabel,
	AppNavLink,
	BAND_FIELD_HEIGHT,
	pageNote,
	SEARCH_PARAM,
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

/** Ties the saved-search name field to the label naming it, which is drawn for listeners. */
const SAVE_SEARCH_FIELD_ID = "save-search-name";

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

/** Width a pinned feed's card will not be squeezed past before the strip wraps. */
const PINNED_CARD_FLOOR = "14rem";

/** Width it stops growing at, so three titles never run the width of a wide window. */
const PINNED_CARD_CAP = "22rem";

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
 * What a search page looked at, said under the list. A bounded search that shows nothing
 * has to name the span it covered, because the confusing failure is the one where the post
 * exists and the search was never allowed to reach it.
 *
 * @param i18next - The request's dictionary.
 * @param locale - The request's language, which words and orders the date.
 * @param span - How far the page reached, and what stopped it there.
 */
function searchedCopy(i18next: i18n, locale: string, span: UserStore.SearchSpan): string {
	let date = exactDate(span.reachedAt, locale);

	if (span.stoppedAt === "archive") return i18next.t("reading.searched.archive", { date });

	if (span.stoppedAt === "window") {
		return i18next.t("reading.searched.window", { date, days: span.windowDays ?? 0 });
	}

	return i18next.t("reading.searched.step", { date });
}

/**
 * The sentence a saved-search action is reported with, or `null` for an ordinary visit.
 * Keeping a query and forgetting one both end on the queue, which is the one surface that
 * renders the list a saved search is a narrowing of.
 *
 * @param i18next - The request's dictionary.
 * @param params - The query the page was asked for with.
 */
function savedSearchNote(i18next: i18n, params: URLSearchParams): Note | null {
	let outcome = params.get(SAVED_PARAM);
	if (outcome === null) return null;

	if (outcome === "saved") return { message: i18next.t("searches.saved"), color: "success" };
	if (outcome === "forgotten") {
		return { message: i18next.t("searches.forgotten"), color: "success" };
	}

	let refusals: Record<string, string> = {
		"invalid-name": i18next.t("searches.error.invalidName", { length: SEARCH_NAME_LENGTH }),
		"invalid-query": i18next.t("searches.error.invalidQuery"),
		"duplicate-name": i18next.t("searches.error.duplicateName"),
		"not-found": i18next.t("searches.error.notFound"),
		full: i18next.t("searches.error.full", { limit: SAVED_SEARCH_LIMIT }),
	};

	let message = refusals[outcome];
	return message === undefined ? null : { message, color: "warning" };
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
		/** What the list is allowed to do, which the request's own client answers. */
		flags: Client;
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

	/**
	 * A frame is continuing a queue already on screen, which is paging rather than opening:
	 * it reads the page and checks nothing. `lazy-frame` fetches a page per screenful, and a
	 * freshness check on each would cost a round trip a reader never sees the result of.
	 */
	let isFrame = isFrameRequest(ctx.request);

	let freshness: UserStore.Freshness | null = null;
	let page: UserStore.TimelineResult;

	/**
	 * The feeds the reader never wants to miss, asked for as their own bounded question and
	 * drawn above the queue. A frame is continuing a queue already on screen, and the strip
	 * is already in the document that frame is written into.
	 */
	let pinned = isFrame ? [] : await store.pinnedStrip();

	if (isFrame) {
		page = await store.readingQueue({
			cursor,
			readState: view.readState,
			query: view.query,
			feedId: view.feedId,
			limit: PAGE_SIZE,
		});
	} else {
		let opened = await store.openReader({
			cursor,
			readState: view.readState,
			query: view.query,
			feedId: view.feedId,
			limit: PAGE_SIZE,
		});

		page = opened.timeline;
		freshness = opened.freshness;

		/**
		 * Behind the response rather than in front of it. The page below is already read, and
		 * the posts this brings in reach the reader through the frames that refetch as they
		 * move — so nothing here is waited on, and a reader missing two hundred feeds is not
		 * held while they are fetched.
		 */
		if (freshness.count > 0) waitUntil(store.synchronize(freshness.stale));
	}

	/**
	 * A cursor the store no longer decodes leaves the reader holding a place that is gone,
	 * so the newest page is shown with a note saying where they landed. The second read is a
	 * read alone: what is waiting was answered by the first, whichever page it came back with.
	 */
	let isStaleCursor = !page.ok;
	if (!page.ok) {
		page = await store.readingQueue({
			cursor: null,
			readState: view.readState,
			query: view.query,
			feedId: view.feedId,
			limit: PAGE_SIZE,
		});
	}
	if (!page.ok) throw new Error("The first page of a timeline decodes without a cursor");

	/** The queue gathers every feed, so a row names the one its post came from. */
	let entries = timelineEntries(
		ctx,
		page.items,
		new Map(page.feeds.map((feed) => [feed.id, feed.title])),
		false,
		keepingLinkParameters(page.feeds),
	);

	/**
	 * An empty queue reads one way for somebody following nothing, who is invited to start,
	 * and another for somebody whose feeds hold no post the narrowing asks for.
	 */
	let hasFeeds = entries.length === 0 ? (await store.countFeeds()) > 0 : true;

	let hasQuery = view.query.trim().length > 0;

	/**
	 * The queries this reader kept, asked for only where the answer is used: the header
	 * offers to keep the one being read, and offers to forget it where it is already kept.
	 * A frame continues a queue whose header is already on screen.
	 */
	let kept = hasQuery && !isFrame ? await store.listSearches() : [];

	let keptHere =
		kept.find(
			(search) =>
				search.query.trim() === view.query.trim() &&
				search.readState === view.readState &&
				search.feedId === view.feedId,
		) ?? null;

	/**
	 * What this page's scan covered, said under the list. A step returns an uneven page —
	 * fifty posts, or three, or none — so the sentence names the span rather than letting a
	 * short page read as the end of the archive.
	 */
	let searched = page.search ? searchedCopy(ctx.i18next, ctx.locale, page.search) : null;

	let heading = hasQuery
		? ctx.i18next.t("reading.headingFor", { query: view.query })
		: ctx.i18next.t("reading.heading");

	let empty = emptyCopy(ctx.i18next, view);

	/** The narrowing alone, which is where the newest page of it lives. */
	let here = queueUrl(view);

	/**
	 * Where this page sits in the queue and what the ways off both ends of it are. The
	 * narrowing rides in every one of those addresses, so choosing a filter and then
	 * scrolling never drops it.
	 */
	let place = placePage({
		address: (at, extra) => queueUrl(view, at, extra),
		params: ctx.url.searchParams,
		cursor,
		isStaleCursor,
		rows: entries.length,
		pageSize: PAGE_SIZE,
		cursors: page.cursors,
	});

	/**
	 * What a list is allowed to do beyond printing its rows, both of which a reader can be
	 * put back to the far side of without a deploy: fetching the page below as they arrive
	 * at it, and keeping a post out of everything that empties the queue.
	 *
	 * Turning the paging off leaves the links that walk the list by hand, which is what a
	 * browser running no script is served — so the way back is a path already walked rather
	 * than one this switch invents.
	 */
	let [paging, saving] = await Promise.all([
		ctx.flags.get(features.infinitePagination),
		ctx.flags.get(features.savedPosts),
	]);

	let placement = paging ? place : { ...place, continueSrc: null, resumeSrc: null };

	/** The copy every row of the list prints, whichever shape this page is answered in. */
	let listCopy = timelineCopy(ctx.i18next);

	/**
	 * The span this page covered, and the way on from it where there is one. The link is the
	 * one "Older posts" already is, relabelled: it follows the same cursor, which for a step
	 * that filled no page is the boundary minted from the floor rather than from a row.
	 */
	let searchedNote =
		searched === null ? null : (
			<p mix={[text("sm"), fg("neutral.muted")]}>
				{searched}{" "}
				{page.search?.stoppedAt === "step" && placement.cursors.next !== null && (
					<a href={placement.cursors.next} mix={[fg("brand")]}>
						{ctx.i18next.t("reading.searched.continue")}
					</a>
				)}
			</p>
		);

	/**
	 * A frame asked for the piece that continues a queue already on screen, so it is
	 * answered with that piece: the rows, numbered on from where the page above stopped,
	 * and whatever carries the reader on from the end of them. The chrome, the heading and
	 * the header's controls are all already in the document this is written into.
	 */
	if (isFrame) {
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
				<>
					<Timeline entries={entries} copy={listCopy} saving={saving} {...placement} />
					{searchedNote}
				</>
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
		flags: ctx.flags,
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
		markNote(ctx.i18next, ctx.url.searchParams) ??
		checkAllNote(ctx.i18next, ctx.url.searchParams) ??
		savedSearchNote(ctx.i18next, ctx.url.searchParams);

	/**
	 * What the reader has not got yet, which is news about the queue rather than the outcome
	 * of anything they pressed, so it stands on its own line and keeps the page's own tone.
	 * It counts feeds rather than posts: how much each of them holds is exactly what has not
	 * been read yet.
	 */
	let waiting =
		freshness && freshness.count > 0
			? ctx.i18next.t("reading.waiting", { count: freshness.count })
			: null;

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
						<QueueFields query={view.query} readState={view.readState} feedId={view.feedId} />

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
					 * Keeping the query being read, or letting go of one already kept. It is offered
					 * only where there is a query to keep, and it posts the narrowing as fields rather
					 * than the address, so what is kept is a queue of this app's.
					 *
					 * A saved search is a link rather than a surface, so both outcomes come back to
					 * this same page and are said in the same line every other action is said in.
					 */}
					{hasQuery &&
						(keptHere === null ? (
							<form
								method="post"
								action={routes.searches.create.href()}
								mix={[attrs({ "data-rmx-document": "" }), flex(), items("center"), gap(2)]}
							>
								<QueueFields query={view.query} readState={view.readState} feedId={view.feedId} />

								<label htmlFor={SAVE_SEARCH_FIELD_ID} mix={[visuallyHidden()]}>
									{ctx.i18next.t("searches.nameLabel")}
								</label>

								<input
									id={SAVE_SEARCH_FIELD_ID}
									type="text"
									name={NAME_FIELD}
									required
									maxLength={SEARCH_NAME_LENGTH}
									placeholder={ctx.i18next.t("searches.namePlaceholder")}
									mix={[
										minIs(0),
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

								<Button
									type="submit"
									color="neutral"
									variant="ghost"
									size="sm"
									aria-label={ctx.i18next.t("searches.save")}
									title={ctx.i18next.t("searches.save")}
								>
									<BookmarkIcon size={ACTION_ICON_SIZE} />
									<ActionLabel>{ctx.i18next.t("searches.save")}</ActionLabel>
								</Button>
							</form>
						) : (
							/**
							 * A browser form sends `GET` and `POST` alone, so the declared `DELETE` rides
							 * in `_method` and `methodOverride()` reads it back out.
							 */
							<form
								method="post"
								action={routes.searches.delete.href({ searchId: keptHere.id })}
								mix={[attrs({ "data-rmx-document": "" })]}
							>
								<input type="hidden" name="_method" value="DELETE" />

								<Button
									type="submit"
									color="neutral"
									variant="ghost"
									size="sm"
									aria-label={ctx.i18next.t("searches.forget")}
									title={ctx.i18next.t("searches.forget")}
								>
									<BookmarkIcon size={ACTION_ICON_SIZE} />
									<ActionLabel>{ctx.i18next.t("searches.forget")}</ActionLabel>
								</Button>
							</form>
						))}

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
						action={routes.reading.action.href()}
						/**
						 * Submitted by the browser itself rather than fetched and patched in. Following
						 * changes the sidebar, the queue and what the field should say next, so there is
						 * no part of this page worth preserving across it — and the browser's own
						 * submission is the one that cannot arrive without the field a reader typed
						 * into, because it is the same thing that refuses to send an empty one.
						 */
						mix={[
							attrs({ "data-rmx-document": "" }),
							flex(),
							items("center"),
							grow(),
							minIs(FOLLOW_FIELD_FLOOR),
							maxIs(FOLLOW_FIELD_CAP),
						]}
					>
						<QueueFields query={view.query} readState={view.readState} feedId={view.feedId} />

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
								fields: (
									<QueueFields query={view.query} readState={view.readState} feedId={view.feedId} />
								),
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

				{waiting && (
					<Alert color="neutral" mix={pageNote()}>
						<Alert.Description>{waiting}</Alert.Description>
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

				{/**
				 * The feeds the reader pinned, each with the newest few posts of it they have not
				 * read. It is a card per feed rather than one list, so a busy pin does not bury a
				 * quiet one, and it asks its own bounded question: the queue below keeps every
				 * column and predicate it had, so a pin cannot move a post out from under anybody
				 * mid-scroll. A pinned feed's newest post therefore appears twice, which is the
				 * visible price of not letting a pin touch the timeline's predicate.
				 */}
				{pinned.length > 0 && (
					<section aria-label={ctx.i18next.t("feeds.pin.label")} mix={[flex(), flexWrap(), gap(4)]}>
						{pinned.map((entry) => (
							<article
								key={entry.feed.id}
								mix={[
									vstack({ gap: 2 }),
									grow(),
									minIs(PINNED_CARD_FLOOR),
									maxIs(PINNED_CARD_CAP),
									p(3),
									rounded("lg"),
									border({ color: "neutral.border", width: 1 }),
								]}
							>
								<h2 mix={[text("sm")]}>
									<a
										href={routes.feed.href({ feed: entry.feed.id })}
										mix={[fg("neutral.emphasis"), textDecoration("none")]}
									>
										{entry.feed.title}
									</a>
								</h2>

								{entry.items.length > 0 ? (
									<ul mix={[vstack({ gap: 1 }), p(0), text("xs")]}>
										{entry.items.map((item) => (
											<li key={item.id} mix={[truncate()]}>
												<a
													href={item.url ?? routes.feed.href({ feed: entry.feed.id })}
													mix={[fg("brand"), textDecoration("none")]}
												>
													{item.title}
												</a>
											</li>
										))}
									</ul>
								) : (
									<p mix={[text("xs"), fg("neutral.muted")]}>
										{ctx.i18next.t("feeds.pin.caughtUp")}
									</p>
								)}
							</article>
						))}
					</section>
				)}

				{entries.length > 0 ? (
					<>
						<Timeline entries={entries} copy={listCopy} saving={saving} {...placement} />
						{searchedNote}
					</>
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

						{searchedNote}
					</HeadingScope>
				)}
			</div>
		</AppLayout>,
		init,
	);
}

/**
 * The submitted form: the address, and the narrowing the queue this was sent from is
 * reading under. An absent or non-text field reads as the empty string, which the store
 * refuses as an address exactly as it refuses a reader's typo, so one branch answers both,
 * and which the queue reads as no narrowing at all.
 */
const FollowForm = f.object({
	url: f.field(s.defaulted(s.string(), "")),
	[SEARCH_PARAM]: f.field(s.defaulted(s.string(), "")),
	[SHOW_PARAM]: f.field(s.defaulted(s.string(), "")),
});

/** The `feeds.follow.error.*` key explaining each way the store can refuse an address. */
const FOLLOW_ERROR_KEYS: Record<Exclude<UserStore.FollowFailure, "over-limit">, string> = {
	"invalid-url": "feeds.follow.error.invalidUrl",
	"not-found": "feeds.follow.error.notFound",
	unreachable: "feeds.follow.error.unreachable",
	"already-following": "feeds.follow.error.alreadyFollowing",
};

/**
 * The sentence a refusal is reported with. A feed cap is the one refusal whose sentence
 * carries numbers, because the way out of it is the reader's and it is a count: unfollow
 * this many, or move up a tier.
 *
 * @param ctx - The request's dictionary.
 * @param refused - What the store refused, and why.
 */
function followError(
	ctx: Pick<ReadingQueue.Context, "i18next">,
	refused: UserStore.FollowResult & { ok: false },
): string {
	if (refused.reason !== "over-limit") return ctx.i18next.t(FOLLOW_ERROR_KEYS[refused.reason]);

	return ctx.i18next.t("feeds.follow.error.overLimit", {
		allowed: refused.limit.allowed,
		count: refused.limit.allowed,
	});
}

/**
 * The scheme somebody's address carries, or what it has instead of one.
 *
 * @param input - The address as it was submitted.
 */
function schemeOf(input: string): string {
	let trimmed = input.trim();
	if (trimmed.length === 0) return "empty";

	return /^([a-z][\d+.a-z-]*):/i.exec(trimmed)?.[1]?.toLowerCase() ?? "none";
}

export default createController(routes.reading, {
	middleware: [requireUser],
	actions: {
		/** GET /reading — every post, narrowed by whatever the header's controls are set to. */
		async index(ctx) {
			/**
			 * A malformed paging parameter falls back to the newest page, which is what this
			 * URL shows without one, rather than to an error page the reader can do nothing
			 * about.
			 */
			let params = parsePageParams(ctx.url.searchParams);
			let cursor = isFailure(params) ? null : params.data.cursor;

			return await renderReadingQueue(ctx, readQueueView(ctx.url.searchParams), cursor, {
				error: null,
				value: null,
			});
		},

		/**
		 * POST /reading — follows whatever feed an address leads to.
		 *
		 * It is posted to the queue's own address rather than to the subscriptions, because
		 * the queue is what answers it: a refused address comes back on this page, and the
		 * address a reader is left on has to be one they can reload. An address answering no
		 * `GET` leaves a reload re-sending the submission that got them there, which arrives
		 * without the field they typed into and is refused as an address they never gave.
		 */
		async action(ctx) {
			let viewer = getViewer();
			if (!viewer) throw new Error("requireUser must run before this handler");

			let store = userStore(viewer.id);
			let submitted = s.parseSafe(FollowForm, ctx.formData);

			let url = submitted.success ? submitted.value.url : "";

			/**
			 * Rebuilt from the two fields rather than from a whole address somebody submitted, so
			 * what comes back is a queue of this app's and never wherever a posted URL pointed.
			 */
			let view = queueViewOf(
				submitted.success ? (submitted.value[SEARCH_PARAM] ?? "") : "",
				submitted.success ? (submitted.value[SHOW_PARAM] ?? "") : "",
			);

			/**
			 * A submission carrying no address at all is not a reader's typo, and must not be
			 * answered as one. The field refuses an empty value before the browser sends it, so
			 * nobody can submit one on purpose: what arrives this way is a request replayed
			 * without the body that gave it meaning — a restored history entry, a resend on a
			 * page that was reloaded. Telling the reader that what they typed is not an address,
			 * while what they typed is still sitting in the box, is the one answer that can only
			 * be read as a lie.
			 *
			 * The queue answers instead, through a redirect, which also turns the entry the
			 * reader is standing on back into one a reload simply repeats.
			 */
			if (url.trim().length === 0) {
				currentLog()?.set({ "follow.refused": "empty-submission" });

				return redirect(queueUrl(view), { status: redirect.Status.SeeOther });
			}

			let followed = await store.followFeed(url);

			if (followed.ok) {
				/** The sidebar lists this feed now. */
				await forgetRailFeeds(viewer.id);

				return redirect(queueUrl(view), { status: redirect.Status.SeeOther });
			}

			/**
			 * What was refused and why, recorded where a refusal a reader reports can be read
			 * back. The scheme is the field that decides the commonest one, and it is the part of
			 * an address that says nothing about what somebody reads.
			 */
			currentLog()?.set({
				"follow.refused": followed.reason,
				"follow.scheme": schemeOf(url),
				"follow.length": url.length,
			});

			/**
			 * The queue comes back carrying the refusal and the address that earned it, so the
			 * reader reads why, corrects what they typed, and keeps the posts they were reading
			 * under them. The field has no room beneath it for a sentence, so the queue reports
			 * it where it reports every other outcome and the field points at that note by name.
			 */
			return renderReadingQueue(
				ctx,
				view,
				null,
				{ error: followError(ctx, followed), value: url },
				UnprocessableEntity,
			);
		},
	},
});
