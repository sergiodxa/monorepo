/**
 * Feed-list controller for `GET /feeds`: every feed the reader follows, each with its
 * unread count and the state of its last check, above the form that follows another one.
 * The page is exported because a refused follow is answered with the page it came from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@sdxc/i18n";
import type { Renderer } from "remix/middleware/render";
import type { RemixNode } from "remix/ui";

import { createAction } from "remix/router";

import type { FeedStatus } from "~/database/schema";
import type { UserStore } from "~/database/user-do";
import type { FeedList as FeedListTypes } from "~/resources/views/feed-list";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import AppLayout from "~/resources/layouts/app";
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

export namespace FeedsPage {
	/**
	 * What the page needs off the request. Narrower than the full `RequestContext` so the
	 * follow action, which renders this page from its own handler, hands over exactly the
	 * renderer, dictionary and language the markup reads.
	 */
	export interface Context {
		render: Renderer<RemixNode>;
		i18next: i18n;
		locale: string;
	}

	/** What the follow form has to say when the page is rendered. */
	export interface Submission {
		/** The translated refusal shown against the field, or `null` for a fresh form. */
		error: string | null;
		/** The submitted address, put back so a typo is corrected rather than retyped. */
		value: string | null;
	}
}

/**
 * Renders the feed page: the chrome, the follow form, and the followed feeds.
 *
 * Every label is resolved here, because the view prints the strings it is handed and the
 * dictionary belongs with the request that detected the language.
 *
 * @param ctx - The request's renderer, dictionary and language.
 * @param feeds - Every feed the reader follows, newest subscription first.
 * @param submission - The refusal to show against the follow field, and the value to restore.
 * @param init - Response status and headers; omit for the plain `200` the list is served with.
 * @example return renderFeedsPage(ctx, feeds, { error: null, value: null });
 */
export function renderFeedsPage(
	ctx: FeedsPage.Context,
	feeds: UserStore.FeedSummary[],
	submission: FeedsPage.Submission,
	init?: ResponseInit,
) {
	let dates = new Intl.DateTimeFormat(ctx.locale);

	let entries = feeds.map((feed): FeedListTypes.Entry => {
		let statusKey = feed.lastStatus ? FAILURE_STATUS_KEYS[feed.lastStatus] : undefined;
		let isFailing = feed.failureCount > 0 && statusKey !== undefined;

		return {
			id: feed.id,
			title: feed.title,
			description: feed.description,
			hasUnread: feed.unreadCount > 0,

			unreadLabel:
				feed.unreadCount > 0
					? ctx.i18next.t("feeds.index.unread", { count: feed.unreadCount })
					: ctx.i18next.t("feeds.index.allRead"),

			checkedLabel:
				feed.lastFetchedAt === null
					? ctx.i18next.t("feeds.index.neverChecked")
					: ctx.i18next.t("feeds.index.checked", {
							date: dates.format(new Date(feed.lastFetchedAt)),
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
			current="feeds"
			locale={ctx.locale}
			nav={{
				label: ctx.i18next.t("nav.label"),
				reading: ctx.i18next.t("nav.reading"),
				feeds: ctx.i18next.t("nav.feeds"),
				settings: ctx.i18next.t("nav.settings"),
				logout: ctx.i18next.t("nav.logout"),
			}}
		>
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

		let feeds = await userStore(viewer.id).listFeeds();

		return renderFeedsPage(ctx, feeds, { error: null, value: null });
	},
});
