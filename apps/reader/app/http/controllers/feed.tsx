/**
 * Single-feed controller for `GET /reading/:feed`: one feed's posts, read and unread
 * alike, newest first, headed by the feed's name — which is the link to the site behind
 * it — and, on that same line, the ways to act on the feed as a whole: check it now, take
 * its unread posts out of the queue, and stop following it.
 *
 * It sits under the queue because it is the same list narrowed to one publisher. What that
 * publisher says about itself and how its last checks went are here too: a reader looks at
 * a feed's health while they are looking at the feed. The checks belong to the feed rather
 * than to any one follower, so that half is asked of the feed's own object — one call, on
 * the one page about one feed, which answers with the feed's true head as well.
 *
 * How long this feed's posts stay is the reader's own answer and sits beside it. What the
 * feed actually publishes is measured, and where the two disagree the page says so and
 * leaves the setting alone: a measurement is a good reason to ask a reader a question and
 * a bad reason to delete their posts.
 *
 * The feed is looked up in the reader's own storage, so a feed somebody else follows is
 * as absent here as one nobody does, and both answer `404`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	CircleCheckIcon,
	EllipsisIcon,
	FolderIcon,
	HourglassIcon,
	LinkIcon,
	BellIcon,
	BellOffIcon,
	PinIcon,
	RefreshCwIcon,
	UnlinkIcon,
} from "@sdxc/icons";
import { parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { boxSizing, flex, flexWrap, gap, items, justify, vstack } from "@sdxc/u/layout";
import { bs, maxIs, minIs, p, pb } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import {
	Alert,
	Badge,
	Button,
	Confirm,
	Empty,
	HeadingScope,
	LinkButton,
	Menu,
	Text,
} from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";
import { attrs } from "remix/ui";

import type { FeedStatus } from "~/database/feed-schema";

import { chrome } from "~/app/http/controllers/chrome";
import { PARAMETERS_FIELD, PARAMETERS_PARAM } from "~/app/http/controllers/feeds/link-parameters";
import { NOTIFY_FIELD, NOTIFY_PARAM } from "~/app/http/controllers/feeds/notify";
import { PIN_FIELD, PIN_PARAM } from "~/app/http/controllers/feeds/pin";
import { MARKED_PARAM } from "~/app/http/controllers/feeds/read";
import { CHECKED_PARAM } from "~/app/http/controllers/feeds/refresh";
import { VELOCITY_FIELD, VELOCITY_PARAM } from "~/app/http/controllers/feeds/velocity";
import { FOLDER_PARAM, TITLE_FIELD } from "~/app/http/controllers/folders/create";
import { FOLDER_FIELD } from "~/app/http/controllers/folders/file";
import { placePage } from "~/app/http/controllers/list-paging";
import {
	exactDate,
	shortDate,
	timelineCopy,
	timelineEntries,
} from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { isFrameRequest } from "~/app/http/render";
import { features } from "~/app/lib/flags";
import { feedStore } from "~/database/feed-do";
import { VELOCITIES } from "~/database/schema";
import { userStore } from "~/database/user-do";
import AppLayout, {
	ActionLabel,
	BAND_FIELD_HEIGHT,
	PAGE_COLUMN,
	pageNote,
} from "~/resources/layouts/app";
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

/**
 * The `id` the overflow menu answers to, which its trigger names in `commandfor`, carrying
 * the feed for the reason the prompt's does.
 *
 * @param feedId - The feed whose remaining actions the menu holds.
 */
function moreMenuId(feedId: string): string {
	return `more-${feedId}`;
}

/**
 * The `id` the velocity menu answers to, which its trigger names in `commandfor`, carrying
 * the feed for the reason the prompt's does.
 *
 * @param feedId - The feed whose spans the menu offers.
 */
function velocityMenuId(feedId: string): string {
	return `velocity-${feedId}`;
}

/**
 * The `id` the filing menu answers to, which its trigger names in `commandfor`, carrying
 * the feed for the reason the prompt's does.
 *
 * @param feedId - The feed whose folders the menu offers.
 */
function folderMenuId(feedId: string): string {
	return `folder-${feedId}`;
}

/** The `id` tying the filing menu's own field to the label naming it. */
function folderFieldId(feedId: string): string {
	return `folder-name-${feedId}`;
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

/**
 * The copy and tone for the outcome a velocity submission redirects back with, or `null`
 * when this is an ordinary visit. `missing` needs no entry: a feed the reader does not
 * follow renders the not-found page above, which never reaches this.
 *
 * @param velocity - The redirect's `velocity` parameter, as it arrived.
 */
/**
 * The copy and tone for the outcome a pin submission redirects back with, or `null` when
 * this is an ordinary visit. `missing` needs no entry: a feed the reader does not follow
 * renders the not-found page, which never reaches this.
 *
 * @param pin - The redirect's `pin` parameter, as it arrived.
 */
function pinNote(pin: string | null): Note | null {
	if (pin === "pinned") return { key: "feeds.pin.pinned", color: "success" };
	if (pin === "unpinned") return { key: "feeds.pin.unpinned", color: "success" };
	if (pin === "full") return { key: "feeds.pin.full", color: "warning" };
	return null;
}

/**
 * The copy and tone for the outcome an opt-in redirects back with, or `null` when this is
 * an ordinary visit.
 *
 * @param notify - The redirect's `notify` parameter, as it arrived.
 */
function notifyNote(notify: string | null): Note | null {
	if (notify === "on") return { key: "notifications.feed.turnedOn", color: "success" };
	if (notify === "off") return { key: "notifications.feed.turnedOff", color: "success" };
	return null;
}

/**
 * The copy and tone for the outcome a link-parameters submission redirects back with, or
 * `null` when this is an ordinary visit.
 *
 * @param parameters - The redirect's `parameters` parameter, as it arrived.
 */
function parametersNote(parameters: string | null): Note | null {
	if (parameters === "kept") return { key: "feeds.linkParameters.kept", color: "success" };
	if (parameters === "stripped") return { key: "feeds.linkParameters.stripped", color: "success" };
	return null;
}

function velocityNote(velocity: string | null): Note | null {
	if (velocity === "saved") return { key: "feeds.velocity.saved", color: "success" };
	if (velocity === "invalid") return { key: "feeds.velocity.invalid", color: "warning" };
	return null;
}

/**
 * The copy and tone for the outcome a filing submission redirects back with, or `null`
 * when this is an ordinary visit. `missing` needs no entry: a feed the reader does not
 * follow renders the not-found page above, which never reaches this.
 *
 * @param folder - The redirect's `folder` parameter, as it arrived.
 */
function folderNote(folder: string | null): Note | null {
	if (folder === "filed") return { key: "folders.file.filed", color: "success" };
	if (folder === "unfiled") return { key: "folders.file.unfiled", color: "success" };
	if (folder === "gone") return { key: "folders.file.gone", color: "warning" };
	if (folder === "invalid") return { key: "folders.invalid", color: "warning" };
	return null;
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
								<LinkButton href={routes.reading.index.href()} size="sm">
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
			checkNote(ctx.url.searchParams.get(CHECKED_PARAM)) ??
			velocityNote(ctx.url.searchParams.get(VELOCITY_PARAM)) ??
			pinNote(ctx.url.searchParams.get(PIN_PARAM)) ??
			notifyNote(ctx.url.searchParams.get(NOTIFY_PARAM)) ??
			parametersNote(ctx.url.searchParams.get(PARAMETERS_PARAM)) ??
			folderNote(ctx.url.searchParams.get(FOLDER_PARAM));

		/**
		 * The page is headed by the feed's own name, so naming it again on every row below
		 * says nothing; the author is what tells one of this feed's posts from another.
		 */
		let entries = timelineEntries(
			ctx,
			page.items,
			null,
			false,
			feed.keepLinkParameters ? new Set([feed.id]) : new Set<string>(),
		);

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
		let place = placePage({
			address: (at, extra) => feedUrl(feedId, at, extra),
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
					<Timeline entries={entries} copy={listCopy} saving={saving} {...placement} />
				),
			);
		}

		/**
		 * What the publisher says this feed is, and how the last checks of it went. A reader
		 * asks after a feed's health while they are looking at the feed, so it is read here
		 * rather than off a list of every feed they follow.
		 *
		 * The checks are the feed's own rather than this reader's — one fetch serves everybody
		 * following it — so they are asked of the object that made them. One call, on the one
		 * page that is about one feed, and it is made below the frame branch above so paging
		 * this list costs nothing. An object that has never answered leaves every line of this
		 * reading as a feed nobody has checked yet, which is what it is.
		 */
		let [health, folders] = await Promise.all([
			feedStore(feed.feedId).health(),
			/**
			 * The folders this feed could be filed into, read below the frame branch above so
			 * paging the list costs nothing. It is a short table and the whole of it fits in
			 * the control that offers it.
			 */
			store.listFolders(),
		]);

		let statusKey = health?.status ? FAILURE_STATUS_KEYS[health.status] : undefined;

		let failures = health?.failureCount ?? 0;

		let failureLabel =
			failures > 0 && statusKey
				? ctx.i18next.t("feeds.show.failingBecause", {
						failures: ctx.i18next.t("feeds.show.failing", { count: failures }),
						reason: ctx.i18next.t(statusKey),
					})
				: null;

		let lastFetchedAt = health?.lastFetchedAt ?? null;

		let checkedLabel =
			lastFetchedAt === null
				? ctx.i18next.t("feeds.show.neverChecked")
				: ctx.i18next.t("feeds.show.checked", {
						date: shortDate(lastFetchedAt, ctx.locale, Date.now()),
					});

		/**
		 * What the feed actually publishes, against what this reader asked to keep of it. The
		 * rate is measured once for the feed and shared by everybody following it, so a busy
		 * feed is known to be busy the first time anybody looks.
		 *
		 * It produces a sentence and nothing else. The subscription is left exactly as the
		 * reader set it, including the Evergreen it starts at, because a rule that deletes a
		 * post they have not read is theirs to ask for.
		 */
		let postsPerDay = health?.postsPerDay ?? null;

		/**
		 * The reader's own copy of that rate, written down where the number was asked for
		 * anyway. It is what the rail's quiet group is derived from, so nothing walks the
		 * subscriptions to keep it and nobody is asked to restate a measurement.
		 */
		await store.recordPublishingRate(feedId, postsPerDay);

		/**
		 * How much a feed has to publish before the question is worth a reader's attention is
		 * a judgement about people rather than about storage, and nobody has yet watched one
		 * being asked. It is read from a flag so the answer can move on evidence rather than
		 * on a deploy, and so it can be asked of one reader before it is asked of everybody.
		 */
		let busyRate = await ctx.flags.get(features.velocitySuggestionRate);

		let isBusy = feed.velocity === "evergreen" && postsPerDay !== null && postsPerDay >= busyRate;

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

						{/**
						 * Everything else a feed can be told, behind one trigger. Checking it and
						 * marking it read are what a reader reaches for while reading; pinning it,
						 * filing it, how long its posts stay and whether it may interrupt are decided
						 * once and then left alone, and eight controls on one line made the two that
						 * are pressed often as hard to find as the six that are not.
						 *
						 * The rows that submit carry their own form, so each is the same single POST
						 * it was on the line. The two that choose open their own menu from here, which
						 * is the nesting the menu already answers for.
						 */}
						<Button
							commandfor={moreMenuId(feedId)}
							command="toggle-popover"
							color="neutral"
							variant="ghost"
							size="sm"
							aria-label={ctx.i18next.t("feeds.more.legend")}
							title={ctx.i18next.t("feeds.more.legend")}
						>
							{/**
							 * The three dots a surface of further actions is named by everywhere, and
							 * the whole control: the two beside it say what they do because they do it,
							 * and a word here would only name the place the rest went.
							 */}
							<EllipsisIcon size={ACTION_ICON_SIZE} />
						</Button>

						<Menu id={moreMenuId(feedId)} aria-label={ctx.i18next.t("feeds.more.legend")}>
							{/**
							 * Pinning draws this feed above the queue, where a reader looks before they
							 * start reading. It changes nothing the queue holds: the strip asks its own
							 * bounded question and the queue below keeps every column and predicate it had.
							 */}
							<form method="post" action={routes.feeds.pin.href({ feedId })}>
								<input
									type="hidden"
									name={PIN_FIELD}
									value={feed.pinnedAt === null ? "true" : "false"}
								/>

								<Menu.Item type="submit" mix={[gap(2)]}>
									<PinIcon size={ACTION_ICON_SIZE} />
									{ctx.i18next.t(feed.pinnedAt === null ? "feeds.pin.submit" : "feeds.pin.remove")}
								</Menu.Item>
							</form>

							{/**
							 * Whether a check that finds posts here is worth interrupting the reader for.
							 * It is a judgement about this publisher, so it is stored on the subscription
							 * and every browser they are reached on shares it; how they are reached is set
							 * once, on the settings page, rather than again per feed.
							 */}
							<form method="post" action={routes.feeds.notify.href({ feedId })}>
								<input type="hidden" name={NOTIFY_FIELD} value={feed.notify ? "false" : "true"} />

								<Menu.Item type="submit" mix={[gap(2)]}>
									{feed.notify ? (
										<BellOffIcon size={ACTION_ICON_SIZE} />
									) : (
										<BellIcon size={ACTION_ICON_SIZE} />
									)}

									{ctx.i18next.t(feed.notify ? "notifications.feed.off" : "notifications.feed.on")}
								</Menu.Item>
							</form>

							{/**
							 * A post's outbound link is rendered with its campaign metadata and click
							 * identifiers removed, which leaves the reader's arrival unattributed and is
							 * what almost every publisher's server is indifferent to. This is for the one
							 * that is not: a site routing on a parameter the strip removes answers a broken
							 * address, and the reader fixes that publisher here rather than the feature.
							 */}
							<form method="post" action={routes.feeds.linkParameters.href({ feedId })}>
								<input
									type="hidden"
									name={PARAMETERS_FIELD}
									value={feed.keepLinkParameters ? "false" : "true"}
								/>

								<Menu.Item type="submit" mix={[gap(2)]}>
									<LinkIcon size={ACTION_ICON_SIZE} />
									{ctx.i18next.t(
										feed.keepLinkParameters
											? "feeds.linkParameters.strip"
											: "feeds.linkParameters.keep",
									)}
								</Menu.Item>
							</form>

							<Menu.Separator />

							{/**
							 * How long this feed's posts stay, which is the one control on this page that
							 * can take away a post the reader has not read. It is a thing done to this
							 * feed, like checking it or letting it go, so it belongs among these rather
							 * than in a section of the page to read past on the way to the posts.
							 *
							 * The row wears the answer, so the setting is legible without opening
							 * anything, and choosing is the whole interaction: one click decides, where a
							 * field and a submit asked for two.
							 */}
							<Menu.Item
								commandfor={velocityMenuId(feedId)}
								command="toggle-popover"
								mix={[justify("between"), gap(4)]}
							>
								<span mix={[flex(), items("center"), gap(2)]}>
									{/** Time running out, which is what every span but one describes. */}
									<HourglassIcon size={ACTION_ICON_SIZE} />
									{ctx.i18next.t("feeds.velocity.legend")}
								</span>

								<span mix={[text("xs"), fg("neutral.muted")]}>
									{ctx.i18next.t(`feeds.velocity.name.${feed.velocity}` as const)}
								</span>
							</Menu.Item>

							{/**
							 * Which group this feed reads in, which is a thing done to the feed the way
							 * checking it and setting its span are. The row wears the answer, so the
							 * filing is legible without opening anything.
							 */}
							<Menu.Item
								commandfor={folderMenuId(feedId)}
								command="toggle-popover"
								mix={[justify("between"), gap(4)]}
							>
								<span mix={[flex(), items("center"), gap(2)]}>
									{/** A folder, which is what the feed is being put into. */}
									<FolderIcon size={ACTION_ICON_SIZE} />
									{ctx.i18next.t("folders.file.legend")}
								</span>

								<span mix={[text("xs"), fg("neutral.muted")]}>
									{feed.folderTitle ?? ctx.i18next.t("folders.file.none")}
								</span>
							</Menu.Item>

							<Menu.Separator />

							<Menu.Item
								danger
								commandfor={unfollowPromptId(feedId)}
								command="show-modal"
								mix={[gap(2)]}
							>
								{/** The tie between this reader and the feed, drawn as the broken link it becomes. */}
								<UnlinkIcon size={ACTION_ICON_SIZE} />
								{ctx.i18next.t("feeds.unfollow.submit")}
							</Menu.Item>
						</Menu>

						<Menu id={velocityMenuId(feedId)} aria-label={ctx.i18next.t("feeds.velocity.legend")}>
							{/**
							 * One form around every row, so each row is a submit carrying its own value.
							 * The name leads and the span follows it quietly: a reader picking between
							 * these is matching a kind of feed to a length of time, and the two read as
							 * one line rather than as a phrase to parse.
							 */}
							<form method="post" action={routes.feeds.velocity.href({ feedId })}>
								<Text mix={[p(2), pb(1), text("xs"), fg("neutral.muted")]}>
									{ctx.i18next.t("feeds.velocity.description")}
								</Text>

								{VELOCITIES.map((velocity) => (
									<Menu.Item
										key={velocity}
										type="submit"
										name={VELOCITY_FIELD}
										value={velocity}
										aria-selected={velocity === feed.velocity ? "true" : undefined}
										mix={[justify("between"), gap(4)]}
									>
										<span>{ctx.i18next.t(`feeds.velocity.name.${velocity}` as const)}</span>
										<span mix={[text("xs"), fg("neutral.muted")]}>
											{ctx.i18next.t(`feeds.velocity.window.${velocity}` as const)}
										</span>
									</Menu.Item>
								))}
							</form>
						</Menu>

						{/**
						 * Every folder the reader has is a submit of its own, the one it is in is
						 * marked, and the field at the foot files it under a name they type — which
						 * is where most folders come from. Without script the menu is a popover the
						 * browser opens itself and each row is a plain submit, so it is the same
						 * control either way.
						 */}
						<Menu id={folderMenuId(feedId)} aria-label={ctx.i18next.t("folders.file.legend")}>
							<form method="post" action={routes.folders.file.href({ feedId })}>
								<Text mix={[p(2), pb(1), text("xs"), fg("neutral.muted")]}>
									{ctx.i18next.t("folders.file.description")}
								</Text>

								{folders.map((folder) => (
									<Menu.Item
										key={folder.id}
										type="submit"
										name={FOLDER_FIELD}
										value={folder.id}
										aria-selected={folder.id === feed.folderId ? "true" : undefined}
										mix={[justify("between"), gap(4)]}
									>
										<span>{folder.title}</span>
									</Menu.Item>
								))}

								{/**
								 * Takes the feed out of the folder it is in, which is the empty value the
								 * filing route reads as no folder at all. It is offered only to a feed
								 * that is in one, since taking an unfiled feed out of nothing does nothing.
								 */}
								{feed.folderId !== null && (
									<Menu.Item type="submit" name={FOLDER_FIELD} value="">
										{ctx.i18next.t("folders.file.remove")}
									</Menu.Item>
								)}

								<div mix={[flex(), items("center"), gap(2), p(2)]}>
									<label htmlFor={folderFieldId(feedId)} mix={[visuallyHidden()]}>
										{ctx.i18next.t("folders.name.label")}
									</label>

									<input
										id={folderFieldId(feedId)}
										type="text"
										name={TITLE_FIELD}
										placeholder={ctx.i18next.t("folders.name.placeholder")}
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

									<Button type="submit" size="sm">
										{ctx.i18next.t("folders.file.submit")}
									</Button>
								</div>
							</form>
						</Menu>
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
								title={lastFetchedAt === null ? undefined : exactDate(lastFetchedAt, ctx.locale)}
							>
								{checkedLabel}
							</span>
						</div>

						{/**
						 * The measurement, put to the reader as a question and left there. It reads
						 * beside what the feed is rather than beside the control that answers it,
						 * because it is news about the feed: how much it publishes, and that nothing
						 * currently leaves. Nothing here changes a setting — a measurement is a good
						 * reason to ask somebody a question and a bad reason to delete their posts.
						 */}
						{isBusy && postsPerDay !== null && (
							<Text mix={[text("xs"), fg("neutral.muted")]}>
								{ctx.i18next.t("feeds.velocity.suggestion", { count: Math.round(postsPerDay) })}
							</Text>
						)}
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
						<Timeline entries={entries} copy={listCopy} saving={saving} {...placement} />
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
