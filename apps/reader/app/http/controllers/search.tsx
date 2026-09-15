/**
 * Search controller for `GET /search`: posts matching what the reader typed, across every
 * feed they follow, newest first.
 *
 * The words live in the URL under `q`, the name a search box has carried since the first
 * one, so a result page is a link somebody can send, bookmark and reload into the same
 * list. The form is a `GET` for that same reason, and paging carries the query beside the
 * cursor so the second page of a search is still that search.
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
import { flex, gap, items, vstack } from "@sdxc/u/layout";
import { maxIs, p } from "@sdxc/u/size";
import { Alert, Button, Card, Empty, HeadingScope, LinkButton, Text, TextField } from "@sdxc/ui";
import { createAction } from "remix/router";

import type { UserStore } from "~/database/user-do";

import { timelineEntries } from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import AppLayout, { PAGE_COLUMN } from "~/resources/layouts/app";
import Timeline from "~/resources/views/timeline";
import routes from "~/routes/web";

/** The search box's own parameter, and the name the form's field submits under. */
const QUERY_PARAM = "q";

/**
 * The URL of one page of results. The query rides along with the cursor, so following
 * "older posts" stays inside the search that produced them; `null` for the cursor gives
 * the first page of that same search.
 *
 * @param query - What the reader typed, exactly as it arrived.
 * @param cursor - The boundary the store minted, or `null` for the first page.
 */
function searchPage(query: string, cursor: string | null): string {
	let params = new URLSearchParams({ [QUERY_PARAM]: query });
	if (cursor !== null) params.set("cursor", cursor);
	return `${routes.search.href()}?${params}`;
}

/** GET /search — posts matching what the reader typed. */
export default createAction(routes.search, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let store = userStore(viewer.id);

		/**
		 * The query reaches the store exactly as it was typed, since the spacing between the
		 * words is part of what somebody searched for. Trimming decides one thing only:
		 * whether anything was searched for at all, so a box holding spaces reads as empty.
		 */
		let query = ctx.url.searchParams.get(QUERY_PARAM) ?? "";
		let hasQuery = query.trim().length > 0;

		/**
		 * An empty box is an invitation rather than a result, so the store is left alone:
		 * there is no search yet to run.
		 */
		let page: Extract<UserStore.TimelineResult, { ok: true }> | null = null;
		let isStaleCursor = false;

		if (hasQuery) {
			/**
			 * A malformed paging parameter falls back to the first page of results, which is
			 * what this URL shows without one, rather than to an error page the reader can do
			 * nothing about.
			 */
			let params = parsePageParams(ctx.url.searchParams);
			let cursor = isFailure(params) ? null : params.data.cursor;

			let found = await store.searchPosts(query, { cursor });

			/**
			 * A cursor the store no longer decodes leaves the reader holding a place that is
			 * gone, so the first page is shown with a note saying where they landed.
			 */
			isStaleCursor = !found.ok;
			if (!found.ok) found = await store.searchPosts(query, { cursor: null });
			if (!found.ok) throw new Error("The first page of a timeline decodes without a cursor");

			page = found;
		}

		/** A search reaches every followed feed, so a result names the one it came from. */
		let entries = timelineEntries(
			ctx,
			page?.items ?? [],
			new Map((page?.feeds ?? []).map((feed) => [feed.id, feed.title])),
		);

		let next = page?.cursors.next ?? null;
		let prev = page?.cursors.prev ?? null;

		/**
		 * The store answers one page, so how many posts match is known only when this page
		 * holds all of them. A page with a neighbour on either side belongs to a total nobody
		 * counted, and such a page shows the results and leaves the counting alone.
		 */
		let total = next === null && prev === null ? entries.length : null;

		return ctx.render(
			<AppLayout
				documentTitle={ctx.i18next.t("search.title")}
				heading={ctx.i18next.t("search.heading")}
				/**
				 * Search reaches the posts of every followed feed, which is the reading surface,
				 * and the navigation offers no tab of its own to mark.
				 */
				current="search"
				width="list"
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
					{/** The results take the window; one field asking for a few words does not. */}
					<Card mix={[p(4), maxIs(PAGE_COLUMN)]}>
						<form
							method="get"
							action={routes.search.href()}
							mix={[vstack({ gap: 3, align: "stretch" })]}
						>
							{/**
							 * The query goes back into the box so the next search edits the last one. It
							 * arrives as an attribute value, which the renderer escapes quote and all, so
							 * a search for markup stays a string rather than becoming one.
							 */}
							<TextField
								type="search"
								name={QUERY_PARAM}
								label={ctx.i18next.t("search.label")}
								placeholder={ctx.i18next.t("search.placeholder")}
								defaultValue={query}
								autoComplete="off"
							/>

							{/**
							 * Under the field and at the start of the row, so it sits beneath the words it
							 * submits rather than a card's width away from them.
							 */}
							<div mix={[flex(), items("center"), gap(2)]}>
								<Button type="submit">{ctx.i18next.t("search.submit")}</Button>
							</div>
						</form>
					</Card>

					{isStaleCursor && (
						<Alert color="warning">
							<Alert.Description>{ctx.i18next.t("timeline.badCursor")}</Alert.Description>
							<Alert.Action>
								<LinkButton
									href={searchPage(query, null)}
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
						<div mix={[vstack({ gap: 4 })]}>
							{/**
							 * The query prints as a text node, which the renderer escapes, so a reader
							 * searching for markup is shown the words they typed.
							 */}
							{total !== null && (
								<Text>{ctx.i18next.t("search.results", { count: total, query })}</Text>
							)}

							<Timeline
								entries={entries}
								/**
								 * A search reaches every post a reader has, read and unread alike, so the
								 * mark says which of the two a result is rather than offering to finish a
								 * post that was finished months ago.
								 */
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
									next: next === null ? null : searchPage(query, next),
									prev: prev === null ? null : searchPage(query, prev),
								}}
							/>
						</div>
					) : (
						/** Level 2, since the layout's own page heading is the document's only `h1`. */
						<HeadingScope level={2}>
							{hasQuery ? (
								<Empty>
									<Empty.Title>{ctx.i18next.t("search.none.title")}</Empty.Title>
									<Empty.Description>{ctx.i18next.t("search.none.description")}</Empty.Description>
								</Empty>
							) : (
								<Empty>
									<Empty.Title>{ctx.i18next.t("search.prompt.title")}</Empty.Title>
									<Empty.Description>
										{ctx.i18next.t("search.prompt.description")}
									</Empty.Description>
								</Empty>
							)}
						</HeadingScope>
					)}
				</div>
			</AppLayout>,
		);
	},
});
