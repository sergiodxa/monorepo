/**
 * Label controller for `GET /tags/:tag`: the posts a reader kept under one label, newest
 * first, as one list.
 *
 * It is the saved list narrowed to one reason for keeping. The page is read through the
 * index the labels are stored under, whose leading column is the label and whose two behind
 * it are the ordering columns in the order they are ordered by, so a page is a range scan
 * down one index rather than a filter, a join and a sort — and it mints the same cursor
 * shape every other list in this app mints.
 *
 * The ways to act on the label are on its own line: renaming it, which writes one row and
 * rewrites no post, and letting it go, which deletes none and unsaves none.
 *
 * The label is looked up in the reader's own storage, so one somebody else made is as
 * absent here as one nobody did, and both answer `404`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { PencilIcon, Trash2Icon } from "@sdxc/icons";
import { parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { boxSizing, flex, gap, items, vstack } from "@sdxc/u/layout";
import { bs, maxIs, minIs, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Alert, Button, Confirm, Empty, HeadingScope, LinkButton, Menu } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";
import { attrs } from "remix/ui";

import { chrome } from "~/app/http/controllers/chrome";
import { placePage } from "~/app/http/controllers/list-paging";
import { NAME_FIELD, TAG_PARAM } from "~/app/http/controllers/tags/create";
import {
	taggingCopy,
	timelineCopy,
	timelineEntries,
} from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { isFrameRequest } from "~/app/http/render";
import { features } from "~/app/lib/flags";
import { userStore } from "~/database/user-do";
import AppLayout, {
	ActionLabel,
	BAND_FIELD_HEIGHT,
	PAGE_COLUMN,
	pageNote,
} from "~/resources/layouts/app";
import Timeline from "~/resources/views/timeline";
import routes from "~/routes/web";

/** How many posts one page of the list holds, which is the number every other list shows. */
const PAGE_SIZE = 25;

/** Edge of the marks the header's own controls are drawn with, sized to the words beside them. */
const ACTION_ICON_SIZE = 16;

/** The path this route matches, which carries the label being read. */
const Params = s.object({ tag: s.string() });

/** One line of copy the page says an action's outcome in, and the tone it wears. */
interface Note {
	key: string;
	color: "success" | "warning";
}

/**
 * The copy and tone for the outcome a label action redirects back with, or `null` when this
 * is an ordinary visit.
 *
 * @param outcome - The redirect's `tag` parameter, as it arrived.
 */
function tagNote(outcome: string | null): Note | null {
	if (outcome === "created") return { key: "tags.created", color: "success" };
	if (outcome === "renamed") return { key: "tags.renamed", color: "success" };
	if (outcome === "duplicate") return { key: "tags.duplicate", color: "warning" };
	if (outcome === "tag-exists") return { key: "tags.duplicate", color: "warning" };
	if (outcome === "tag-name-invalid") return { key: "tags.invalid", color: "warning" };
	if (outcome === "tag-limit") return { key: "tags.full", color: "warning" };
	if (outcome === "not-entitled") return { key: "tags.notEntitled", color: "warning" };
	return null;
}

/**
 * The URL of one page of the list, which is what the timeline's older and newer links
 * carry: the cursor alone would resolve against whatever page the browser is on.
 *
 * @param tagId - The label being paged through.
 * @param cursor - The boundary the store minted, or `null` for the newest page.
 * @param extra - Parameters this page's address has to carry beyond the cursor.
 */
function tagUrl(tagId: string, cursor: string | null, extra: Record<string, string> = {}): string {
	let params = new URLSearchParams();
	if (cursor !== null) params.set("cursor", cursor);
	for (let [name, value] of Object.entries(extra)) params.set(name, value);

	let base = routes.tag.href({ tag: tagId });
	let query = params.toString();
	return query.length === 0 ? base : `${base}?${query}`;
}

/** The `id` the rename form's popover answers to, which its trigger names in `commandfor`. */
function renameMenuId(tagId: string): string {
	return `rename-tag-${tagId}`;
}

/** The `id` the delete prompt answers to, which its trigger names in `commandfor`. */
function deletePromptId(tagId: string): string {
	return `delete-tag-${tagId}`;
}

/** The `id` the page's own list of label names is offered under. */
function optionsId(tagId: string): string {
	return `tag-names-${tagId}`;
}

/** GET /tags/:tag — the kept posts under one label, and the ways to act on the label. */
export default createAction(routes.tag, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		/**
		 * Labels can be turned off, and this list is the whole of what they are for: with them
		 * off there is nothing here to show and no way to put anything here, so a reader
		 * following a bookmark is sent to the posts they kept rather than shown an empty list.
		 */
		if (!(await ctx.flags.get(features.tags))) {
			return redirect(routes.saved.href(), { status: redirect.Status.SeeOther });
		}

		let { tag: tagId } = s.parse(Params, ctx.params);
		let store = userStore(viewer.id);

		let tag = await store.getTag(tagId);

		if (!tag) {
			return ctx.render(
				<AppLayout
					documentTitle={ctx.i18next.t("tags.notFound.title")}
					heading={ctx.i18next.t("tags.notFound.title")}
					locale={ctx.locale}
					{...await chrome(ctx)}
				>
					{/** Level 2, since the layout's own page heading is the document's only `h1`. */}
					<HeadingScope level={2}>
						<Empty>
							<Empty.Title>{ctx.i18next.t("tags.notFound.title")}</Empty.Title>
							<Empty.Description>{ctx.i18next.t("tags.notFound.description")}</Empty.Description>
							<Empty.Action>
								<LinkButton href={routes.saved.href()} size="sm">
									{ctx.i18next.t("tags.notFound.back")}
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

		let page = await store.taggedQueue(tagId, { cursor, limit: PAGE_SIZE });

		/**
		 * A cursor the store no longer decodes leaves the reader holding a place that is gone,
		 * so the newest page is shown with a note saying where they landed.
		 */
		let isStaleCursor = !page.ok;
		if (!page.ok) page = await store.taggedQueue(tagId, { cursor: null, limit: PAGE_SIZE });
		if (!page.ok) throw new Error("The first page of a timeline decodes without a cursor");

		/** The list gathers every feed, so a row names the one its post came from. */
		let entries = timelineEntries(
			ctx,
			page.items,
			new Map(page.feeds.map((feed) => [feed.id, feed.title])),
			true,
		);

		let place = placePage({
			address: (at, extra) => tagUrl(tagId, at, extra),
			params: ctx.url.searchParams,
			cursor,
			isStaleCursor,
			rows: entries.length,
			pageSize: PAGE_SIZE,
			cursors: page.cursors,
		});

		let paging = await ctx.flags.get(features.infinitePagination);
		let placement = paging ? place : { ...place, continueSrc: null, resumeSrc: null };

		let listCopy = timelineCopy(ctx.i18next);

		/** Every label the reader has, which the field on each row offers by name. */
		let tagging = {
			copy: taggingCopy(ctx.i18next),
			options: (await store.listTags()).map((held) => held.name),
			optionsId: optionsId(tagId),
		};

		/**
		 * A frame asked for the piece continuing a list already on screen, so it is answered
		 * with that piece alone: the rows, numbered on from the page they continue.
		 */
		if (isFrameRequest(ctx.request)) {
			return ctx.render(
				isStaleCursor ? (
					<Alert color="warning" mix={pageNote()}>
						<Alert.Description>{ctx.i18next.t("timeline.badCursor")}</Alert.Description>
						<Alert.Action>
							<LinkButton
								href={routes.tag.href({ tag: tagId })}
								color="neutral"
								variant="outline"
								size="sm"
							>
								{ctx.i18next.t("timeline.restart")}
							</LinkButton>
						</Alert.Action>
					</Alert>
				) : (
					<Timeline entries={entries} copy={listCopy} tagging={tagging} {...placement} />
				),
			);
		}

		let note = tagNote(ctx.url.searchParams.get(TAG_PARAM));

		return ctx.render(
			<AppLayout
				documentTitle={tag.name}
				heading={tag.name}
				/** On the label's own line, so acting on it costs a click rather than a scroll. */
				actions={
					<>
						<Button
							commandfor={renameMenuId(tagId)}
							command="toggle-popover"
							color="neutral"
							variant="ghost"
							size="sm"
							aria-label={ctx.i18next.t("tags.rename.submit")}
							title={ctx.i18next.t("tags.rename.submit")}
						>
							{/** A pencil, which is the mark for changing the words on something. */}
							<PencilIcon size={ACTION_ICON_SIZE} />
							<ActionLabel>{ctx.i18next.t("tags.rename.submit")}</ActionLabel>
						</Button>

						<Menu id={renameMenuId(tagId)} aria-label={ctx.i18next.t("tags.rename.legend")}>
							{/**
							 * A field and its submit, which is the one control on this page that needs
							 * two: a name is typed rather than chosen. Without script the popover is the
							 * browser's own and the form is a plain submit, so it works either way.
							 */}
							<form
								method="post"
								action={routes.tags.rename.href({ tagId })}
								mix={[attrs({ "data-rmx-document": "" }), flex(), items("center"), gap(2), p(2)]}
							>
								<label htmlFor={`rename-name-${tagId}`} mix={[visuallyHidden()]}>
									{ctx.i18next.t("tags.name.label")}
								</label>

								<input
									id={`rename-name-${tagId}`}
									type="text"
									name={NAME_FIELD}
									required
									defaultValue={tag.name}
									placeholder={ctx.i18next.t("tags.name.placeholder")}
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
									{ctx.i18next.t("tags.rename.submit")}
								</Button>
							</form>
						</Menu>

						<Button
							commandfor={deletePromptId(tagId)}
							command="show-modal"
							color="danger"
							variant="ghost"
							size="sm"
							aria-label={ctx.i18next.t("tags.delete.submit")}
							title={ctx.i18next.t("tags.delete.submit")}
						>
							<Trash2Icon size={ACTION_ICON_SIZE} />
							<ActionLabel>{ctx.i18next.t("tags.delete.submit")}</ActionLabel>
						</Button>
					</>
				}
				locale={ctx.locale}
				{...await chrome(ctx)}
			>
				<div mix={[vstack({ gap: 6 })]}>
					{/**
					 * What deleting the label does, which is nothing to any post: they stop carrying
					 * it and stay kept. How many that is is the only consequence there is, so it is
					 * the whole of what the prompt says.
					 *
					 * Level 2, since the layout's own page heading is the document's only `h1`.
					 *
					 * The confirmation posts `_method`, since a browser form sends `GET` and `POST`
					 * alone and `methodOverride()` reads the declared `DELETE` back out of it.
					 */}
					<HeadingScope level={2}>
						<Confirm
							id={deletePromptId(tagId)}
							parts={{ form: [attrs({ "data-rmx-document": "" })] }}
							title={ctx.i18next.t("tags.delete.title")}
							description={ctx.i18next.t("tags.delete.confirm", {
								name: tag.name,
								count: entries.length,
							})}
							confirmLabel={ctx.i18next.t("tags.delete.submit")}
							cancelLabel={ctx.i18next.t("tags.delete.cancel")}
							form={{
								action: routes.tags.delete.href({ tagId }),
								fields: <input type="hidden" name="_method" value="DELETE" />,
							}}
						/>
					</HeadingScope>

					{note && (
						<Alert color={note.color} mix={pageNote()}>
							<Alert.Description>{ctx.i18next.t(note.key)}</Alert.Description>
						</Alert>
					)}

					{isStaleCursor && (
						<Alert color="warning" mix={pageNote()}>
							<Alert.Description>{ctx.i18next.t("timeline.badCursor")}</Alert.Description>
							<Alert.Action>
								<LinkButton
									href={routes.tag.href({ tag: tagId })}
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
						<Timeline entries={entries} copy={listCopy} tagging={tagging} {...placement} />
					) : (
						/** Level 2, since the layout's own page heading is the document's only `h1`. */
						<HeadingScope level={2}>
							<Empty mix={[maxIs(PAGE_COLUMN), text("sm")]}>
								<Empty.Title>{ctx.i18next.t("tags.empty.title")}</Empty.Title>
								<Empty.Description>{ctx.i18next.t("tags.empty.description")}</Empty.Description>
							</Empty>
						</HeadingScope>
					)}
				</div>
			</AppLayout>,
		);
	},
});
