import { redirect } from "@pkg/http/response";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import { getAuthUser } from "~/app/http/middleware/auth";
import { LikePost } from "~/app/repositories/posts/like";
import { BookmarkSchema } from "~/app/schemas/cms/bookmark";
import { CMSBookmarksActionView, CMSBookmarksIndexView } from "~/resources/views/cms/bookmarks";
import routes from "~/routes/web";

/**
 * Handles CMS bookmark CRUD flows used by the admin dashboard.
 *
 * The controller keeps route behavior explicit: redirects for missing auth/ids,
 * and 404 HTML views when an edit/update target no longer exists.
 */
export default createController(routes.cms.bookmarks, {
	/**
	 * Reserved for route-level guards.
	 *
	 * Bookmark actions currently perform auth checks inline so each action can
	 * choose its own redirect fallback.
	 */
	middleware: [],

	actions: {
		/**
		 * Renders the bookmarks index with edit and delete affordances.
		 * @param ctx Controller context that provides DB bindings.
		 * @returns HTML view model for the CMS bookmarks listing page.
		 */
		async index(ctx) {
			let bookmarks = await LikePost.findAll(ctx.get(Database));
			let items = bookmarks.map((bookmark) => ({
				id: bookmark.id,
				title: bookmark.meta.title,
				url: bookmark.meta.url,
				href: routes.cms.bookmarks.edit.href({ id: bookmark.id }),
				deleteAction: routes.cms.bookmarks.destroy.href({ id: bookmark.id }),
			}));

			return ctx.render(CMSBookmarksIndexView, { items });
		},

		/**
		 * Creates a bookmark from submitted form values.
		 * Validation failures are surfaced by `succeeded(...)` and abort the action.
		 * @param ctx Controller context with form data and DB access.
		 * @returns See Other redirect to login, edit page for the created record, or index fallback.
		 */
		async create(ctx) {
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), BookmarkSchema);
			succeeded(result, "Invalid bookmark form data");

			let created = await LikePost.create(ctx.get(Database), {
				author_id: user.id,
				meta: {
					title: result.data.title,
					url: result.data.url,
				},
			});

			if (!created)
				return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });

			return redirect(routes.cms.bookmarks.edit.href({ id: created.id }), {
				status: redirect.Status.SeeOther,
			});
		},

		/**
		 * Deletes the bookmark identified by route params.
		 * Missing ids are treated as a no-op to keep delete flows idempotent.
		 * @param ctx Controller context with route params and DB access.
		 * @returns See Other redirect to the bookmarks index in all cases.
		 */
		async destroy(ctx) {
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });

			await LikePost.destroy(ctx.get(Database), id);
			return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });
		},

		/**
		 * Renders the edit form for an existing bookmark id.
		 * The 404 branch intentionally reuses the action view so CMS users stay in-context.
		 * @param ctx Controller context with route params and DB access.
		 * @returns Bookmark edit view, or a 404 form view when the record is missing.
		 */
		async edit(ctx) {
			let id = ctx.params.id;
			let bookmark = id ? await LikePost.findById(ctx.get(Database), id) : null;

			if (!bookmark) {
				let model = {
					title: "Bookmark Not Found",
					description: `Bookmark ${id} was not found.`,
					mode: "new",
					action: routes.cms.bookmarks.index.href(),
					submitLabel: "Create Bookmark",
					values: { title: "", url: "" },
				} satisfies CMSBookmarksActionView.Props;

				return ctx.render(CMSBookmarksActionView, model, { status: 404 });
			}

			let model = {
				title: `Edit Bookmark ${bookmark.meta.title}`,
				description: `Editing bookmark pointing to ${bookmark.meta.url}.`,
				mode: "edit",
				action: routes.cms.bookmarks.update.href({ id: bookmark.id }),
				submitLabel: "Save Bookmark",
				deleteAction: routes.cms.bookmarks.destroy.href({ id: bookmark.id }),
				values: {
					title: bookmark.meta.title ?? "",
					url: bookmark.meta.url ?? "",
				},
			} satisfies CMSBookmarksActionView.Props;

			return ctx.render(CMSBookmarksActionView, model);
		},

		/**
		 * Renders the blank bookmark creation form.
		 * The total count is included in description text for lightweight CMS context.
		 * @param ctx Controller context with DB bindings.
		 * @returns New-mode action view prefilled with empty bookmark values.
		 */
		async new(ctx) {
			let total = (await LikePost.findAll(ctx.get(Database))).length;
			let model = {
				title: "New Bookmark",
				description: `New Bookmark form loaded. Current bookmarks count: ${total}.`,
				mode: "new",
				action: routes.cms.bookmarks.index.href(),
				submitLabel: "Create Bookmark",
				values: { title: "", url: "" },
			} satisfies CMSBookmarksActionView.Props;

			return ctx.render(CMSBookmarksActionView, model);
		},

		/**
		 * Updates an existing bookmark with validated form data.
		 * Authentication and id presence are required; missing prerequisites short-circuit to index.
		 * @param ctx Controller context with params, form data, and DB access.
		 * @returns See Other redirect to index/edit, or a 404 form view when target is missing.
		 */
		async update(ctx) {
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), BookmarkSchema);
			succeeded(result, "Invalid bookmark form data");

			let updated = await LikePost.update(ctx.get(Database), id, {
				author_id: user.id,
				meta: {
					title: result.data.title,
					url: result.data.url,
				},
			});

			if (!updated) {
				let viewModel = {
					title: "Bookmark Not Found",
					description: `Bookmark ${id} was not found.`,
					mode: "new",
					action: routes.cms.bookmarks.index.href(),
					submitLabel: "Create Bookmark",
					values: { title: "", url: "" },
				} satisfies CMSBookmarksActionView.Props;

				return ctx.render(CMSBookmarksActionView, viewModel, { status: 404 });
			}

			return redirect(routes.cms.bookmarks.edit.href({ id }), { status: redirect.Status.SeeOther });
		},
	},
});
