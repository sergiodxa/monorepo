/**
 * Single-feed controller for `GET /feeds/:feedId`: one feed's posts, read and unread
 * alike, newest first, headed by the feed's name — which is the link to the site behind
 * it — and, on that same line, the way to stop following it.
 *
 * The feed is looked up in the reader's own storage, so a feed somebody else follows is
 * as absent here as one nobody does, and both answer `404`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { vstack } from "@sdxc/u/layout";
import { Alert, Button, Confirm, Empty, HeadingScope, LinkButton } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import AppLayout from "~/resources/layouts/app";
import Timeline from "~/resources/views/timeline";
import routes from "~/routes/web";

/**
 * The URL of one page of a feed, which is what the timeline's older and newer links carry:
 * the cursor alone would resolve against whatever page the browser is on.
 *
 * @param feedId - The feed being paged through.
 * @param cursor - The boundary the store minted, or `null` at either end of the feed.
 */
function feedPage(feedId: string, cursor: string | null): string | null {
	if (cursor === null) return null;
	return `${routes.feeds.show.href({ feedId })}?${new URLSearchParams({ cursor })}`;
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

/** GET /feeds/:feedId — one feed and its posts. */
export default createAction(routes.feeds.show, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { feedId } = s.parse(s.object({ feedId: s.string() }), ctx.params);
		let store = userStore(viewer.id);

		let nav = {
			label: ctx.i18next.t("nav.label"),
			reading: ctx.i18next.t("nav.reading"),
			feeds: ctx.i18next.t("nav.feeds"),
			settings: ctx.i18next.t("nav.settings"),
			logout: ctx.i18next.t("nav.logout"),
		};

		let feed = await store.getFeed(feedId);

		if (!feed) {
			return ctx.render(
				<AppLayout
					documentTitle={ctx.i18next.t("feeds.show.notFound.title")}
					heading={ctx.i18next.t("feeds.show.notFound.title")}
					current="feeds"
					locale={ctx.locale}
					nav={nav}
				>
					{/** Level 2, since the layout's own page heading is the document's only `h1`. */}
					<HeadingScope level={2}>
						<Empty>
							<Empty.Title>{ctx.i18next.t("feeds.show.notFound.title")}</Empty.Title>
							<Empty.Description>
								{ctx.i18next.t("feeds.show.notFound.description")}
							</Empty.Description>
							<Empty.Action>
								<LinkButton href={routes.feeds.index.href()} size="sm">
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

		let page = await store.feedTimeline(feedId, { cursor });

		/**
		 * A cursor the store no longer decodes leaves the reader holding a place that is
		 * gone, so the newest page is shown with a note saying where they landed.
		 */
		let isStaleCursor = !page.ok;
		if (!page.ok) page = await store.feedTimeline(feedId, { cursor: null });
		if (!page.ok) throw new Error("The first page of a timeline decodes without a cursor");

		let publishedFormat = new Intl.DateTimeFormat(ctx.locale, { dateStyle: "medium" });

		/** Read outside the mapping below, which is a closure and so widens `feed` again. */
		let feedTitle = feed.title;

		let entries = page.items.map((item) => {
			let meta: string[] = [];

			meta.push(feedTitle);
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

		return ctx.render(
			<AppLayout
				documentTitle={feed.title}
				heading={feed.title}
				/**
				 * On the feed's own line, so stopping following it costs a click rather than a
				 * scroll past every post it ever published.
				 */
				headingActions={
					<Button
						commandfor={unfollowPromptId(feedId)}
						command="show-modal"
						color="danger"
						variant="ghost"
						size="sm"
					>
						{ctx.i18next.t("feeds.unfollow.submit")}
					</Button>
				}
				/** The feed's name is the link to the site behind it, for a feed that names one. */
				headingLink={
					feed.siteUrl
						? { href: feed.siteUrl, label: ctx.i18next.t("feeds.show.visitSite") }
						: undefined
				}
				current="feeds"
				locale={ctx.locale}
				nav={nav}
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

					{isStaleCursor && (
						<Alert color="warning">
							<Alert.Description>{ctx.i18next.t("timeline.badCursor")}</Alert.Description>
							<Alert.Action>
								<LinkButton
									href={routes.feeds.show.href({ feedId })}
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
							/** This page holds a feed's posts read and unread alike, so the mark is a state. */
							readAction="toggle"
							copy={{
								markRead: ctx.i18next.t("timeline.markRead"),
								markUnread: ctx.i18next.t("timeline.markUnread"),
								read: ctx.i18next.t("timeline.read"),
								newer: ctx.i18next.t("timeline.newer"),
								older: ctx.i18next.t("timeline.older"),
							}}
							returnTo={ctx.url.pathname + ctx.url.search}
							cursors={{
								next: feedPage(feedId, page.cursors.next),
								prev: feedPage(feedId, page.cursors.prev),
							}}
						/>
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
