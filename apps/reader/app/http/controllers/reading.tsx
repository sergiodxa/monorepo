/**
 * Reading-queue controller for `GET /reading`: the unread posts across every followed
 * feed, newest first, and the app's landing spot after sign-in.
 *
 * The store answers with posts and, beside them, the feeds those posts came from. Turning
 * that into the byline a reader sees happens here, where the dictionary and the request's
 * language are, so the list itself prints text it is handed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { vstack } from "@sdxc/u/layout";
import { Alert, Empty, HeadingScope, LinkButton } from "@sdxc/ui";
import { createAction } from "remix/router";

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
		let feedTitles = new Map(page.feeds.map((feed) => [feed.id, feed.title]));
		let publishedFormat = new Intl.DateTimeFormat(ctx.locale, { dateStyle: "medium" });

		let entries = items.map((item) => {
			let meta: string[] = [];

			let feedTitle = feedTitles.get(item.feedId);
			if (feedTitle) meta.push(feedTitle);
			if (item.author) meta.push(ctx.i18next.t("timeline.byAuthor", { author: item.author }));
			meta.push(
				ctx.i18next.t("timeline.publishedOn", {
					date: publishedFormat.format(item.publishedAt),
				}),
			);

			return {
				id: item.id,
				title: item.title,
				url: item.url,
				summary: item.summary,
				meta,
				isRead: item.readAt !== null,
			};
		});

		/**
		 * An empty queue reads two ways and only the feed list tells them apart: somebody
		 * following nothing is invited to start, and somebody following feeds has read them.
		 */
		let hasFeeds = items.length === 0 ? (await store.listFeeds()).length > 0 : true;

		return ctx.render(
			<AppLayout
				documentTitle={ctx.i18next.t("reading.title")}
				heading={ctx.i18next.t("reading.heading")}
				current="reading"
				locale={ctx.locale}
				nav={{
					label: ctx.i18next.t("nav.label"),
					reading: ctx.i18next.t("nav.reading"),
					feeds: ctx.i18next.t("nav.feeds"),
					settings: ctx.i18next.t("nav.settings"),
					logout: ctx.i18next.t("nav.logout"),
				}}
			>
				<div mix={[vstack({ gap: 6 })]}>
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
