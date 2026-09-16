/**
 * Folder controller for `GET /reading/folders/:folder`: every post of every feed a reader
 * filed under one name, newest first, as one stream.
 *
 * It sits under the queue because that is what it is — the queue narrowed to a group the
 * reader chose, one step out from a single publisher's page. The page is read from the
 * folder carried on each post rather than gathered from the feeds in the folder, so it
 * seeks like every other list here and a page costs the page.
 *
 * The ways to act on the folder are on its own line: renaming it, making another, and
 * letting it go. A folder holds no posts, so the last of those takes none — its feeds come
 * back unfiled — which is what the prompt says rather than asking anybody to confirm a
 * loss that is not happening.
 *
 * The folder is looked up in the reader's own storage, so one somebody else made is as
 * absent here as one nobody did, and both answer `404`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FolderPlusIcon, PencilIcon, Trash2Icon } from "@sdxc/icons";
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
import { FOLDER_PARAM, TITLE_FIELD } from "~/app/http/controllers/folders/create";
import { placePage } from "~/app/http/controllers/list-paging";
import { timelineCopy, timelineEntries } from "~/app/http/controllers/timeline-entries";
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

/**
 * How many posts one page of a folder holds, which is the number every other list here
 * shows: they are the same rows, and a page is sized to arrive under a reader scrolling
 * rather than to be complete.
 */
const PAGE_SIZE = 25;

/** Edge of the marks the header's own controls are drawn with, sized to the words beside them. */
const ACTION_ICON_SIZE = 16;

/** The path this route matches, which carries the folder being read. */
const Params = s.object({ folder: s.string() });

/** One line of copy the page says an action's outcome in, and the tone it wears. */
interface Note {
	key: string;
	color: "success" | "warning";
}

/**
 * The copy and tone for the outcome a folder action redirects back with, or `null` when
 * this is an ordinary visit. `missing` needs no entry: a folder the reader does not have
 * renders the not-found page above, which never reaches this.
 *
 * @param outcome - The redirect's `folder` parameter, as it arrived.
 */
function folderNote(outcome: string | null): Note | null {
	if (outcome === "created") return { key: "folders.created", color: "success" };
	if (outcome === "renamed") return { key: "folders.renamed", color: "success" };
	if (outcome === "duplicate") return { key: "folders.duplicate", color: "warning" };
	if (outcome === "invalid") return { key: "folders.invalid", color: "warning" };
	return null;
}

/**
 * The URL of one page of a folder, which is what the timeline's older and newer links
 * carry: the cursor alone would resolve against whatever page the browser is on.
 *
 * @param folderId - The folder being paged through.
 * @param cursor - The boundary the store minted, or `null` for the newest page.
 * @param extra - Parameters this page's address has to carry beyond the cursor.
 */
function folderUrl(
	folderId: string,
	cursor: string | null,
	extra: Record<string, string> = {},
): string {
	let params = new URLSearchParams();
	if (cursor !== null) params.set("cursor", cursor);
	for (let [name, value] of Object.entries(extra)) params.set(name, value);

	let base = routes.folder.href({ folder: folderId });
	let query = params.toString();
	return query.length === 0 ? base : `${base}?${query}`;
}

/**
 * The `id` the rename form's popover answers to, which its trigger names in `commandfor`.
 * It carries the folder so the value is this page's alone.
 *
 * @param folderId - The folder the form renames.
 */
function renameMenuId(folderId: string): string {
	return `rename-${folderId}`;
}

/**
 * The `id` the new-folder form's popover answers to, carrying the folder it was opened
 * from for the reason the rename form's does.
 *
 * @param folderId - The folder whose page the form was opened on.
 */
function createMenuId(folderId: string): string {
	return `new-folder-${folderId}`;
}

/**
 * The `id` the delete prompt answers to, which its trigger names in `commandfor`.
 *
 * @param folderId - The folder the prompt would take away.
 */
function deletePromptId(folderId: string): string {
	return `delete-folder-${folderId}`;
}

/** The field both forms on this page type a folder's name into. */
function nameFieldId(prefix: string, folderId: string): string {
	return `${prefix}-name-${folderId}`;
}

/** GET /reading/folders/:folder — one folder's posts, and the ways to act on the folder. */
export default createAction(routes.folder, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { folder: folderId } = s.parse(Params, ctx.params);
		let store = userStore(viewer.id);

		let folder = await store.getFolder(folderId);

		if (!folder) {
			return ctx.render(
				<AppLayout
					documentTitle={ctx.i18next.t("folders.notFound.title")}
					heading={ctx.i18next.t("folders.notFound.title")}
					locale={ctx.locale}
					{...await chrome(ctx)}
				>
					{/** Level 2, since the layout's own page heading is the document's only `h1`. */}
					<HeadingScope level={2}>
						<Empty>
							<Empty.Title>{ctx.i18next.t("folders.notFound.title")}</Empty.Title>
							<Empty.Description>{ctx.i18next.t("folders.notFound.description")}</Empty.Description>
							<Empty.Action>
								<LinkButton href={routes.reading.index.href()} size="sm">
									{ctx.i18next.t("folders.notFound.back")}
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

		let page = await store.folderTimeline(folderId, { cursor, limit: PAGE_SIZE });

		/**
		 * A cursor the store no longer decodes leaves the reader holding a place that is gone,
		 * so the newest page is shown with a note saying where they landed.
		 */
		let isStaleCursor = !page.ok;
		if (!page.ok) page = await store.folderTimeline(folderId, { cursor: null, limit: PAGE_SIZE });
		if (!page.ok) throw new Error("The first page of a timeline decodes without a cursor");

		/** A folder gathers several publishers, so each row names the one its post came from. */
		let entries = timelineEntries(
			ctx,
			page.items,
			new Map(page.feeds.map((feed) => [feed.id, feed.title])),
		);

		let place = placePage({
			address: (at, extra) => folderUrl(folderId, at, extra),
			params: ctx.url.searchParams,
			cursor,
			isStaleCursor,
			rows: entries.length,
			pageSize: PAGE_SIZE,
			cursors: page.cursors,
		});

		let [paging, saving] = await Promise.all([
			ctx.flags.get(features.infinitePagination),
			ctx.flags.get(features.savedPosts),
		]);

		let placement = paging ? place : { ...place, continueSrc: null, resumeSrc: null };

		let listCopy = timelineCopy(ctx.i18next);

		/**
		 * A frame asked for the piece continuing a list already on screen, so it is answered
		 * with that piece alone: the rows, numbered on from the page they continue. The
		 * chrome and everything said about the folder are already in the document.
		 */
		if (isFrameRequest(ctx.request)) {
			return ctx.render(
				isStaleCursor ? (
					<Alert color="warning" mix={pageNote()}>
						<Alert.Description>{ctx.i18next.t("timeline.badCursor")}</Alert.Description>
						<Alert.Action>
							<LinkButton
								href={routes.folder.href({ folder: folderId })}
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

		let note = folderNote(ctx.url.searchParams.get(FOLDER_PARAM));

		return ctx.render(
			<AppLayout
				documentTitle={folder.title}
				heading={folder.title}
				/** On the folder's own line, so acting on the group costs a click rather than a scroll. */
				actions={
					<>
						<Button
							commandfor={renameMenuId(folderId)}
							command="toggle-popover"
							color="neutral"
							variant="ghost"
							size="sm"
							aria-label={ctx.i18next.t("folders.rename.submit")}
							title={ctx.i18next.t("folders.rename.submit")}
						>
							{/** A pencil, which is the mark for changing the words on something. */}
							<PencilIcon size={ACTION_ICON_SIZE} />
							<ActionLabel>{ctx.i18next.t("folders.rename.submit")}</ActionLabel>
						</Button>

						<Menu id={renameMenuId(folderId)} aria-label={ctx.i18next.t("folders.rename.legend")}>
							{/**
							 * A field and its submit, which is the one control on this page that needs
							 * two: a name is typed rather than chosen. Without script the popover is
							 * the browser's own and the form is a plain submit, so it works either way.
							 */}
							<form
								method="post"
								action={routes.folders.rename.href({ folderId })}
								mix={[attrs({ "data-rmx-document": "" }), flex(), items("center"), gap(2), p(2)]}
							>
								<label htmlFor={nameFieldId("rename", folderId)} mix={[visuallyHidden()]}>
									{ctx.i18next.t("folders.name.label")}
								</label>

								<input
									id={nameFieldId("rename", folderId)}
									type="text"
									name={TITLE_FIELD}
									required
									defaultValue={folder.title}
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
									{ctx.i18next.t("folders.rename.submit")}
								</Button>
							</form>
						</Menu>

						<Button
							commandfor={createMenuId(folderId)}
							command="toggle-popover"
							color="neutral"
							variant="ghost"
							size="sm"
							aria-label={ctx.i18next.t("folders.create.submit")}
							title={ctx.i18next.t("folders.create.submit")}
						>
							{/** A folder with something being added to it, which is what this makes. */}
							<FolderPlusIcon size={ACTION_ICON_SIZE} />
							<ActionLabel>{ctx.i18next.t("folders.create.submit")}</ActionLabel>
						</Button>

						<Menu id={createMenuId(folderId)} aria-label={ctx.i18next.t("folders.create.legend")}>
							<form
								method="post"
								action={routes.folders.create.href()}
								mix={[attrs({ "data-rmx-document": "" }), flex(), items("center"), gap(2), p(2)]}
							>
								<label htmlFor={nameFieldId("new", folderId)} mix={[visuallyHidden()]}>
									{ctx.i18next.t("folders.name.label")}
								</label>

								<input
									id={nameFieldId("new", folderId)}
									type="text"
									name={TITLE_FIELD}
									required
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
									{ctx.i18next.t("folders.create.submit")}
								</Button>
							</form>
						</Menu>

						<Button
							commandfor={deletePromptId(folderId)}
							command="show-modal"
							color="danger"
							variant="ghost"
							size="sm"
							aria-label={ctx.i18next.t("folders.delete.submit")}
							title={ctx.i18next.t("folders.delete.submit")}
						>
							<Trash2Icon size={ACTION_ICON_SIZE} />
							<ActionLabel>{ctx.i18next.t("folders.delete.submit")}</ActionLabel>
						</Button>
					</>
				}
				locale={ctx.locale}
				{...await chrome(ctx)}
			>
				<div mix={[vstack({ gap: 6 })]}>
					{/**
					 * What deleting the folder does, which is nothing to any post: the feeds come
					 * back unfiled and everything in them stays. The prompt is a native `dialog` the
					 * trigger opens through Invoker Commands, so the sentence costs nothing until it
					 * is the thing being decided.
					 *
					 * Level 2, since the layout's own page heading is the document's only `h1`.
					 *
					 * The confirmation posts `_method`, since a browser form sends `GET` and `POST`
					 * alone and `methodOverride()` reads the declared `DELETE` back out of it.
					 */}
					<HeadingScope level={2}>
						<Confirm
							id={deletePromptId(folderId)}
							/**
							 * Letting go of a folder is left to the browser to navigate, so the queue it
							 * answers with arrives as a new document and this prompt goes with the old
							 * one.
							 */
							parts={{ form: [attrs({ "data-rmx-document": "" })] }}
							title={ctx.i18next.t("folders.delete.title")}
							description={ctx.i18next.t("folders.delete.confirm", { title: folder.title })}
							confirmLabel={ctx.i18next.t("folders.delete.submit")}
							cancelLabel={ctx.i18next.t("folders.delete.cancel")}
							form={{
								action: routes.folders.delete.href({ folderId }),
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
									href={routes.folder.href({ folder: folderId })}
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
							<Empty mix={[maxIs(PAGE_COLUMN), text("sm")]}>
								<Empty.Title>{ctx.i18next.t("folders.empty.title")}</Empty.Title>
								<Empty.Description>{ctx.i18next.t("folders.empty.description")}</Empty.Description>
							</Empty>
						</HeadingScope>
					)}
				</div>
			</AppLayout>,
		);
	},
});
