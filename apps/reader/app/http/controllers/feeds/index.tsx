/**
 * Feed-list controller for `GET /feeds`: one page of the feeds the reader follows, each
 * with its unread count and the state of its last check, under the form that follows
 * another one and the control that checks them all. A `cursor` parameter says which page,
 * and the links to the pages either side of it are built here, so what the list is handed
 * is a URL to follow rather than a boundary to resolve.
 *
 * A sweep of every feed returns here carrying its counts, which this page turns into the
 * sentence reporting them.
 *
 * The page is exported because a refused follow is answered with the page it came from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@sdxc/i18n";
import type { Renderer } from "remix/middleware/render";
import type { RemixNode } from "remix/ui";

import { parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { Alert, LinkButton } from "@sdxc/ui";
import { createAction } from "remix/router";

import type { FeedStatus } from "~/database/schema";
import type { UserStore } from "~/database/user-do";
import type { FeedList as FeedListTypes } from "~/resources/views/feed-list";

import { chrome } from "~/app/http/controllers/chrome";
import { FAILED_PARAM, FRESH_PARAM, SWEPT_PARAM } from "~/app/http/controllers/feeds/refresh-all";
import { exactDate, shortDate } from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import AppLayout, { pageNote } from "~/resources/layouts/app";
import FeedList from "~/resources/views/feed-list";
import routes from "~/routes/web";

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

/**
 * The URL of one page of the subscription list, which is what its older and newer links
 * carry: the cursor alone would resolve against whatever page the browser is on.
 *
 * @param cursor - The boundary the store minted, or `null` at either end of the list.
 */
function feedsPage(cursor: string | null): string | null {
	if (cursor === null) return null;
	return `${routes.feeds.index.href()}?${new URLSearchParams({ cursor })}`;
}

/**
 * One count off a sweep's redirect, or `null` for a parameter that is absent or is
 * something other than a count, so a URL arrived at by hand reports nothing.
 *
 * @param params - The query the page was asked for with.
 * @param name - The parameter holding the count.
 */
function sweptCount(params: URLSearchParams, name: string): number | null {
	let raw = params.get(name);
	if (raw === null || !/^\d+$/.test(raw)) return null;
	return Number.parseInt(raw, 10);
}

/**
 * The copy and tone for the outcome a check-every-feed redirect carries, or `null` when
 * this is an ordinary view of the list. The sentences read in the order a reader asks the
 * questions in: how many were reached, what came back, and what did not answer.
 *
 * A sweep that left some feeds unreached is a warning rather than a failure, the same tone
 * a single feed's failed check earns, since the feeds that did answer are current.
 *
 * @param ctx - The request's dictionary and the query it arrived with.
 */
function checkAllNote(
	ctx: FeedsPage.Context,
): { message: string; color: "success" | "warning" } | null {
	let swept = sweptCount(ctx.url.searchParams, SWEPT_PARAM);
	if (swept === null) return null;

	let fresh = sweptCount(ctx.url.searchParams, FRESH_PARAM) ?? 0;
	let failed = sweptCount(ctx.url.searchParams, FAILED_PARAM) ?? 0;

	let sentences = [
		ctx.i18next.t("feeds.checkAll.done", { count: swept }),
		fresh > 0
			? ctx.i18next.t("feeds.checkAll.newPosts", { count: fresh })
			: ctx.i18next.t("feeds.checkAll.nothingNew"),
	];

	if (failed > 0) sentences.push(ctx.i18next.t("feeds.checkAll.failed", { count: failed }));

	return { message: sentences.join(" "), color: failed > 0 ? "warning" : "success" };
}

export namespace FeedsPage {
	/**
	 * What the page needs off the request. Narrower than the full `RequestContext` so the
	 * follow action, which renders this page from its own handler, hands over exactly the
	 * renderer, dictionary, language and query the page reads.
	 */
	export interface Context {
		render: Renderer<RemixNode>;
		i18next: i18n;
		locale: string;
		/** The URL asked for, whose query carries what a completed sweep has to report. */
		url: URL;
	}

	/** What the follow form has to say when the page is rendered. */
	export interface Submission {
		/** The translated refusal shown against the field, or `null` for a fresh form. */
		error: string | null;
		/** The submitted address, put back so a typo is corrected rather than retyped. */
		value: string | null;
	}

	/** Where in the subscription list this page sits, and how the reader arrived at it. */
	export interface Listing {
		/**
		 * The boundaries the store minted for this page; omit to render it with no paging
		 * links, which is what a page rendered from the newest end wants.
		 */
		cursors?: { next: string | null; prev: string | null };
		/**
		 * Whether the reader asked for a page whose cursor the store refused, which these
		 * subscriptions are the newest end of rather than the page that was asked for.
		 */
		staleCursor?: boolean;
	}
}

/**
 * Renders the feed page: the chrome, the follow form, and the followed feeds.
 *
 * Every label is resolved here, because the view prints the strings it is handed and the
 * dictionary belongs with the request that detected the language.
 *
 * @param ctx - The request's renderer, dictionary, language and query.
 * @param feeds - One page of the feeds the reader follows, newest subscription first.
 * @param submission - The refusal to show against the follow field, and the value to restore.
 * @param init - Response status and headers; omit for the plain `200` the list is served with.
 * @param listing - Where these subscriptions sit in the list, and whether the cursor that
 * asked for them was refused; omit for a page rendered from the newest end.
 * @example return renderFeedsPage(ctx, page.feeds, { error: null, value: null });
 */
export async function renderFeedsPage(
	ctx: FeedsPage.Context,
	feeds: UserStore.FeedSummary[],
	submission: FeedsPage.Submission,
	init?: ResponseInit,
	listing: FeedsPage.Listing = {},
) {
	let { cursors = { next: null, prev: null }, staleCursor = false } = listing;

	/** The moment every check on this page is read against, so the list dates from one clock. */
	let now = Date.now();

	let note = checkAllNote(ctx);

	let entries = feeds.map((feed): FeedListTypes.Entry => {
		let statusKey = feed.lastStatus ? FAILURE_STATUS_KEYS[feed.lastStatus] : undefined;
		let isFailing = feed.failureCount > 0 && statusKey !== undefined;

		return {
			id: feed.id,
			title: feed.title,
			description: feed.description,

			/** A count is worth a badge while it counts something; nothing waiting says itself. */
			unreadLabel:
				feed.unreadCount > 0
					? ctx.i18next.t("feeds.index.unread", { count: feed.unreadCount })
					: null,

			checked: feed.lastFetchedAt === null ? null : shortDate(feed.lastFetchedAt, ctx.locale, now),

			checkedLabel:
				feed.lastFetchedAt === null
					? ctx.i18next.t("feeds.index.neverChecked")
					: ctx.i18next.t("feeds.index.checked", {
							date: exactDate(feed.lastFetchedAt, ctx.locale),
						}),

			failureLabel:
				isFailing && statusKey
					? ctx.i18next.t("feeds.index.failingBecause", {
							failures: ctx.i18next.t("feeds.index.failing", { count: feed.failureCount }),
							reason: ctx.i18next.t(statusKey),
						})
					: null,
		};
	});

	return ctx.render(
		<AppLayout
			documentTitle={ctx.i18next.t("feeds.index.title")}
			heading={ctx.i18next.t("feeds.index.heading")}
			locale={ctx.locale}
			{...await chrome(ctx)}
		>
			{/**
			 * Above the list, next to the control that produced it, so the answer to a sweep is
			 * the first thing on the page the reader was returned to.
			 */}
			{note && (
				<Alert color={note.color} mix={pageNote()}>
					<Alert.Description>{note.message}</Alert.Description>
				</Alert>
			)}

			{/**
			 * Above the subscriptions it explains, so a reader who followed a link to a page
			 * that is gone reads why these feeds are the ones under it.
			 */}
			{staleCursor && (
				<Alert color="warning" mix={pageNote()}>
					<Alert.Description>{ctx.i18next.t("timeline.badCursor")}</Alert.Description>
					<Alert.Action>
						<LinkButton
							href={routes.feeds.index.href()}
							color="neutral"
							variant="outline"
							size="sm"
						>
							{ctx.i18next.t("timeline.restart")}
						</LinkButton>
					</Alert.Action>
				</Alert>
			)}

			<FeedList
				entries={entries}
				follow={{
					label: ctx.i18next.t("feeds.follow.label"),
					description: ctx.i18next.t("feeds.follow.description"),
					placeholder: ctx.i18next.t("feeds.follow.placeholder"),
					submit: ctx.i18next.t("feeds.follow.submit"),
					error: submission.error,
					value: submission.value,
				}}
				empty={{
					title: ctx.i18next.t("feeds.index.empty.title"),
					description: ctx.i18next.t("feeds.index.empty.description"),
				}}
				checkAll={ctx.i18next.t("feeds.checkAll.submit")}
				paging={{
					newer: feedsPage(cursors.prev),
					older: feedsPage(cursors.next),
					newerLabel: ctx.i18next.t("feeds.paging.newer"),
					olderLabel: ctx.i18next.t("feeds.paging.older"),
				}}
			/>
		</AppLayout>,
		init,
	);
}

/** GET /feeds — the followed-feed list. */
export default createAction(routes.feeds.index, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		/**
		 * A malformed paging parameter falls back to the newest subscriptions, which is what
		 * this URL shows without one, rather than to an error page the reader can do nothing
		 * about.
		 */
		let params = parsePageParams(ctx.url.searchParams);
		let cursor = isFailure(params) ? null : params.data.cursor;

		let store = userStore(viewer.id);
		let page = await store.listFeeds({ cursor });

		/**
		 * A cursor the store no longer decodes leaves the reader holding a place that is
		 * gone, so the newest subscriptions are shown with a note saying where they landed —
		 * an empty list would tell somebody who follows fifty feeds that they follow none.
		 */
		let staleCursor = !page.ok;
		if (!page.ok) page = await store.listFeeds({ cursor: null });
		if (!page.ok)
			throw new Error("The first page of the subscription list decodes without a cursor");

		return await renderFeedsPage(ctx, page.feeds, { error: null, value: null }, undefined, {
			cursors: page.cursors,
			staleCursor,
		});
	},
});
