/**
 * CMS controller for bookmarks: the list with its quick add, the create and edit forms, and
 * delete. Saving goes through the bookmark service, which reads the page to fill what the
 * form left empty and answers the existing bookmark when a URL was saved before.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure, succeeded } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import { getAuthUser } from "~/app/http/middleware/auth";
import jobs from "~/app/jobs";
import { Bookmark } from "~/app/repositories/bookmark";
import { LikePost } from "~/app/repositories/posts/like";
import { BookmarkPrefillSchema, BookmarkSchema } from "~/app/schemas/cms/bookmark";
import { createBookmark, updateBookmark } from "~/app/services/bookmarks";
import { CMSBookmarksActionView, CMSBookmarksIndexView } from "~/resources/views/cms/bookmarks";
import routes from "~/routes/web";

/** How a bookmark's save date reads in the notice of a repeated save. */
const SAVED_ON = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });

/** The empty form, for a new bookmark and for the 404 of one that disappeared. */
const EMPTY_VALUES: CMSBookmarksActionView.FormValues = { title: "", url: "", description: "" };

/** The edit page of a bookmark, opened with the notice that a save found it already saved. */
function duplicateHref(id: string) {
	return `${routes.cms.bookmarks.edit.href({ id })}?duplicate=1`;
}

/**
 * What the edit page says about the latest read of the page: nothing until it was read, and
 * for a page that moved, the edit page again with the new address filled in.
 */
function checkOf(
	record: NonNullable<Awaited<ReturnType<typeof Bookmark.findByPostId>>>,
	id: string,
): CMSBookmarksActionView.Check | undefined {
	let status = Bookmark.statusOf(record);
	if (status === null || record.checked_at === null) return undefined;

	let moved = status === "moved" && record.final_url !== null;
	return {
		status,
		httpStatus: record.http_status,
		checkedOn: SAVED_ON.format(new Date(record.checked_at)),
		finalUrl: record.final_url,
		open: Bookmark.isOpen(record),
		...(moved && record.final_url
			? {
					useFinalHref: `${routes.cms.bookmarks.edit.href({ id })}?${new URLSearchParams({ url: record.final_url })}`,
				}
			: {}),
	};
}

/** The form page shown in place of an edit whose bookmark no longer exists. */
function notFoundModel(id: string | undefined): CMSBookmarksActionView.Props {
	return {
		title: "Bookmark Not Found",
		description: `Bookmark ${id ?? ""} was not found.`,
		mode: "new",
		action: routes.cms.bookmarks.index.href(),
		submitLabel: "Create Bookmark",
		values: EMPTY_VALUES,
	};
}

/**
 * CMS bookmark CRUD. Missing auth or ids answer with redirects, while an edit or update
 * target that has disappeared answers with a 404 HTML view.
 */
export default createController(routes.cms.bookmarks, {
	/**
	 * Each bookmark action runs its own inline auth check so it can pick the redirect
	 * fallback that fits its flow.
	 */
	middleware: [],

	actions: {
		/**
		 * Renders the bookmarks list, titled by each bookmark's label so one saved without a
		 * title still reads as its address, and marking every bookmark whose open flag awaits
		 * review.
		 * @param ctx Controller context that provides DB bindings.
		 * @returns HTML view model for the CMS bookmarks listing page.
		 */
		index: async (ctx) => {
			let [bookmarks, open] = await Promise.all([
				LikePost.findAll(ctx.db),
				Bookmark.findOpen(ctx.db),
			]);
			let items = bookmarks.map((bookmark) => {
				let record = open.get(bookmark.id);
				let flag = record ? Bookmark.flagOf(record) : null;
				return {
					id: bookmark.id,
					title: LikePost.label(bookmark.meta),
					url: bookmark.meta.url,
					href: routes.cms.bookmarks.edit.href({ id: bookmark.id }),
					deleteAction: routes.cms.bookmarks.destroy.href({ id: bookmark.id }),
					...(flag ? { flag } : {}),
				};
			});

			return ctx.render(CMSBookmarksIndexView, { items });
		},

		/**
		 * Saves the full form or the quick add's URL alone. A URL already bookmarked lands on
		 * that bookmark's edit page instead of creating a second one; a page that could not be
		 * read while saving is read again in the background.
		 * @param ctx Controller context with form data and DB access.
		 * @returns See Other redirect to login, or to the saved or existing bookmark's edit page.
		 */
		create: async (ctx) => {
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), BookmarkSchema);
			succeeded(result, "Invalid bookmark form data");

			let saved = await createBookmark(ctx.db, user.id, result.data);
			if (isFailure(saved)) {
				ctx.log.warn("bookmark.save_failed", { message: saved.error.message });
				return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });
			}

			if (saved.data.outcome === "duplicate") {
				return redirect(duplicateHref(saved.data.id), { status: redirect.Status.SeeOther });
			}

			if (!saved.data.read) {
				await ctx.jobs.enqueue(jobs.bookmarks.inspect, { postId: saved.data.id });
			}

			return redirect(routes.cms.bookmarks.edit.href({ id: saved.data.id }), {
				status: redirect.Status.SeeOther,
			});
		},

		/**
		 * A missing id resolves to a plain redirect, keeping delete links idempotent.
		 * @param ctx Controller context with route params and DB access.
		 * @returns See Other redirect to the bookmarks index in all cases.
		 */
		destroy: async (ctx) => {
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });

			await LikePost.destroy(ctx.db, id);
			return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });
		},

		/**
		 * The 404 branch reuses the action view so CMS users stay in context when a bookmark has
		 * disappeared. `?duplicate=1` explains that a save landed here because the URL was saved
		 * before, and `?url=` prefills a new address, such as where a moved page now lives.
		 * @param ctx Controller context with route params and DB access.
		 * @returns Bookmark edit view, or a 404 form view when the record is missing.
		 */
		edit: async (ctx) => {
			let id = ctx.params.id;
			let bookmark = id ? await LikePost.findById(ctx.db, id) : null;
			if (!bookmark) return ctx.render(CMSBookmarksActionView, notFoundModel(id), { status: 404 });

			let record = await Bookmark.findByPostId(ctx.db, bookmark.id);
			let query = await validate(ctx.url.searchParams, BookmarkPrefillSchema);
			let prefill = isFailure(query) ? { url: "", duplicate: "" } : query.data;

			let model = {
				title: `Edit Bookmark ${LikePost.label(bookmark.meta)}`,
				description: `Editing bookmark pointing to ${bookmark.meta.url}.`,
				mode: "edit",
				action: routes.cms.bookmarks.update.href({ id: bookmark.id }),
				submitLabel: "Save Bookmark",
				deleteAction: routes.cms.bookmarks.destroy.href({ id: bookmark.id }),
				values: {
					title: bookmark.meta.title,
					url: prefill.url.trim() || bookmark.meta.url,
					description: bookmark.meta.description,
				},
				...(prefill.duplicate
					? {
							notice: `Already bookmarked on ${SAVED_ON.format(new Date(bookmark.created_at))}.`,
						}
					: {}),
				...(record ? { check: checkOf(record, bookmark.id) } : {}),
			} satisfies CMSBookmarksActionView.Props;

			return ctx.render(CMSBookmarksActionView, model);
		},

		/**
		 * The form for a new bookmark. `?url=` prefills it, which is what a share-sheet shortcut
		 * opens; a URL already bookmarked opens that bookmark instead.
		 * @param ctx Controller context with the query and DB bindings.
		 * @returns New-mode form view, or a redirect to the bookmark already holding the URL.
		 */
		new: async (ctx) => {
			let query = await validate(ctx.url.searchParams, BookmarkPrefillSchema);
			let shared = isFailure(query) ? "" : query.data.url.trim();
			let url = shared === "" ? "" : LikePost.clean(shared);

			if (url !== "") {
				let holder = await Bookmark.findByAddress(ctx.db, LikePost.address(url));
				if (holder) {
					return redirect(duplicateHref(holder.post_id), { status: redirect.Status.SeeOther });
				}
			}

			let model = {
				title: "New Bookmark",
				description:
					"Paste a URL; a title or description left empty is read from the page when you save.",
				mode: "new",
				action: routes.cms.bookmarks.index.href(),
				submitLabel: "Create Bookmark",
				values: { ...EMPTY_VALUES, url },
			} satisfies CMSBookmarksActionView.Props;

			return ctx.render(CMSBookmarksActionView, model);
		},

		/**
		 * Saves an edit, which also marks the bookmark reviewed. A URL another bookmark already
		 * holds is refused with the form shown again, linking to that bookmark; a new URL is
		 * read in the background.
		 * @param ctx Controller context with params, form data, and DB access.
		 * @returns See Other redirect to the edit page, the form again with a 409 on a taken URL,
		 * or a 404 form view when the target is missing.
		 */
		update: async (ctx) => {
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), BookmarkSchema);
			succeeded(result, "Invalid bookmark form data");

			let updated = await updateBookmark(ctx.db, id, user.id, result.data);

			if (updated.outcome === "missing") {
				return ctx.render(CMSBookmarksActionView, notFoundModel(id), { status: 404 });
			}

			if (updated.outcome === "duplicate") {
				let holder = await LikePost.findById(ctx.db, updated.id);
				let model = {
					title: "Edit Bookmark",
					description: "Another bookmark already holds this URL.",
					mode: "edit",
					action: routes.cms.bookmarks.update.href({ id }),
					submitLabel: "Save Bookmark",
					deleteAction: routes.cms.bookmarks.destroy.href({ id }),
					values: result.data,
					conflict: {
						label: holder ? LikePost.label(holder.meta) : result.data.url,
						href: routes.cms.bookmarks.edit.href({ id: updated.id }),
					},
				} satisfies CMSBookmarksActionView.Props;

				return ctx.render(CMSBookmarksActionView, model, { status: 409 });
			}

			if (updated.moved) await ctx.jobs.enqueue(jobs.bookmarks.inspect, { postId: id });

			return redirect(routes.cms.bookmarks.edit.href({ id }), { status: redirect.Status.SeeOther });
		},
	},
});
