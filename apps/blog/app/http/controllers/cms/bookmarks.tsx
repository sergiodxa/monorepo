/**
 * CMS controller for bookmark CRUD. It renders index and edit/new HTML views and handles
 * create, update, and destroy actions against the like-post repository, validating form
 * data with the bookmark schema and using See Other redirects. It exists to manage
 * bookmarks from the admin dashboard, returning in-context 404 views for missing records.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { succeeded } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import { getAuthUser } from "~/app/http/middleware/auth";
import { LikePost } from "~/app/repositories/posts/like";
import { BookmarkSchema } from "~/app/schemas/cms/bookmark";
import { CMSBookmarksActionView, CMSBookmarksIndexView } from "~/resources/views/cms/bookmarks";
import routes from "~/routes/web";

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
		 * Renders the bookmarks index with edit and delete affordances.
		 * @param ctx Controller context that provides DB bindings.
		 * @returns HTML view model for the CMS bookmarks listing page.
		 */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let bookmarks = await LikePost.findAll(db);
			let items = bookmarks.map((bookmark) => ({
				id: bookmark.id,
				title: bookmark.meta.title,
				url: bookmark.meta.url,
				href: routes.cms.bookmarks.edit.href({ id: bookmark.id }),
				deleteAction: routes.cms.bookmarks.destroy.href({ id: bookmark.id }),
			}));

			return ctx.render(CMSBookmarksIndexView, { items });
		}),

		/**
		 * Validation failures abort the action through `succeeded(...)`, so persistence runs only
		 * against a well-formed payload.
		 * @param ctx Controller context with form data and DB access.
		 * @returns See Other redirect to login, edit page for the created record, or index fallback.
		 */
		create: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), BookmarkSchema);
			succeeded(result, "Invalid bookmark form data");

			let created = await LikePost.create(db, {
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
		}),

		/**
		 * A missing id resolves to a plain redirect, keeping delete links idempotent.
		 * @param ctx Controller context with route params and DB access.
		 * @returns See Other redirect to the bookmarks index in all cases.
		 */
		destroy: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });

			await LikePost.destroy(db, id);
			return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });
		}),

		/**
		 * The 404 branch reuses the action view so CMS users stay in context when a bookmark has
		 * disappeared.
		 * @param ctx Controller context with route params and DB access.
		 * @returns Bookmark edit view, or a 404 form view when the record is missing.
		 */
		edit: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let id = ctx.params.id;
			let bookmark = id ? await LikePost.findById(db, id) : null;

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
		}),

		/**
		 * The description carries the current bookmark total to give operators lightweight CMS
		 * context while creating a record.
		 * @param ctx Controller context with DB bindings.
		 * @returns New-mode action view prefilled with empty bookmark values.
		 */
		new: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let total = (await LikePost.findAll(db)).length;
			let model = {
				title: "New Bookmark",
				description: `New Bookmark form loaded. Current bookmarks count: ${total}.`,
				mode: "new",
				action: routes.cms.bookmarks.index.href(),
				submitLabel: "Create Bookmark",
				values: { title: "", url: "" },
			} satisfies CMSBookmarksActionView.Props;

			return ctx.render(CMSBookmarksActionView, model);
		}),

		/**
		 * Requires an authenticated user and a route id; either one missing sends the editor back
		 * to the index.
		 * @param ctx Controller context with params, form data, and DB access.
		 * @returns See Other redirect to index/edit, or a 404 form view when target is missing.
		 */
		update: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), BookmarkSchema);
			succeeded(result, "Invalid bookmark form data");

			let updated = await LikePost.update(db, id, {
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
		}),
	},
});
