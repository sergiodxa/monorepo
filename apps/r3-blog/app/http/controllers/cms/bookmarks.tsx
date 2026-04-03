import { redirect } from "@pkg/http/response";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";

import { getAuthUser } from "~/app/http/middleware/auth";
import { db } from "~/app/http/middleware/db";
import { view } from "~/app/infrastructure/view";
import { LikePost } from "~/app/repositories/posts/like";
import { BookmarkSchema } from "~/app/schemas/cms/bookmark";
import { CMSBookmarksActionView, CMSBookmarksIndexView } from "~/resources/views/cms/bookmarks";
import routes from "~/routes/web";

export default controller<typeof routes.cms.bookmarks>({
	middleware: [],

	actions: {
		async index() {
			let bookmarks = await LikePost.findAll(db());
			let items = bookmarks.map((bookmark) => ({
				id: bookmark.id,
				title: bookmark.meta.title,
				url: bookmark.meta.url,
				href: routes.cms.bookmarks.edit.href({ id: bookmark.id }),
				deleteAction: routes.cms.bookmarks.destroy.href({ id: bookmark.id }),
			}));

			return view(CMSBookmarksIndexView, { items });
		},

		async create() {
			let ctx = getContext() as any;
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), BookmarkSchema);
			succeeded(result, "Invalid bookmark form data");

			let created = await LikePost.create(db(), {
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

		async destroy() {
			let ctx = getContext() as any;
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });

			await LikePost.destroy(db(), id);
			return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });
		},

		async edit() {
			let ctx = getContext() as any;
			let id = ctx.params.id;
			let bookmark = id ? await LikePost.findById(db(), id) : null;

			if (!bookmark) {
				let model = {
					title: "Bookmark Not Found",
					description: `Bookmark ${id} was not found.`,
					mode: "new",
					action: routes.cms.bookmarks.index.href(),
					submitLabel: "Create Bookmark",
					values: { title: "", url: "" },
				} satisfies CMSBookmarksActionView.Props;

				return view(CMSBookmarksActionView, model, { status: 404 });
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

			return view(CMSBookmarksActionView, model);
		},

		async new() {
			let total = (await LikePost.findAll(db())).length;
			let model = {
				title: "New Bookmark",
				description: `New Bookmark form loaded. Current bookmarks count: ${total}.`,
				mode: "new",
				action: routes.cms.bookmarks.index.href(),
				submitLabel: "Create Bookmark",
				values: { title: "", url: "" },
			} satisfies CMSBookmarksActionView.Props;

			return view(CMSBookmarksActionView, model);
		},

		async update() {
			let ctx = getContext() as any;
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), BookmarkSchema);
			succeeded(result, "Invalid bookmark form data");

			let updated = await LikePost.update(db(), id, {
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

				return view(CMSBookmarksActionView, viewModel, { status: 404 });
			}

			return redirect(routes.cms.bookmarks.edit.href({ id }), { status: redirect.Status.SeeOther });
		},
	},
});
