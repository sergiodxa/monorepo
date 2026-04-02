import { redirect } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { renderToString } from "remix/component/server";
import { defaulted, object, string } from "remix/data-schema";

import { CMSLayout } from "~/components/layout/cms";
import { authState } from "~/middleware/auth-state";
import { db } from "~/middleware/db";
import { LikePost } from "~/models/posts/like";
import routes from "~/routes";
import { CMSBookmarksActionView, CMSBookmarksIndexView } from "~/views/cms/bookmarks";

let BookmarkSchema = object({
	title: defaulted(string(), "Untitled bookmark"),
	url: defaulted(string(), "/"),
});

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

			let body = await renderToString(
				<CMSLayout title="Bookmarks" activePath={routes.cms.bookmarks.index.href()}>
					<CMSBookmarksIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(ctx) {
			let user = authState().user;
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

		async destroy(ctx) {
			let bookmarkId = ctx.params.id;
			if (!bookmarkId) {
				return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });
			}

			await LikePost.destroy(db(), bookmarkId);
			return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let bookmark = await LikePost.findById(db(), ctx.params.id);
			if (!bookmark) {
				let view: CMSBookmarksActionView.Props = {
					title: "Bookmark Not Found",
					description: `Bookmark ${ctx.params.id} was not found.`,
					mode: "new",
					action: routes.cms.bookmarks.index.href(),
					submitLabel: "Create Bookmark",
					values: { title: "", url: "" },
				};
				let body = await renderToString(
					<CMSLayout title={view.title} activePath={routes.cms.bookmarks.index.href()}>
						<CMSBookmarksActionView {...view} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let view: CMSBookmarksActionView.Props = {
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
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath={routes.cms.bookmarks.index.href()}>
					<CMSBookmarksActionView {...view} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async new() {
			let total = (await LikePost.findAll(db())).length;
			let view: CMSBookmarksActionView.Props = {
				title: "New Bookmark",
				description: `New Bookmark form loaded. Current bookmarks count: ${total}.`,
				mode: "new",
				action: routes.cms.bookmarks.index.href(),
				submitLabel: "Create Bookmark",
				values: { title: "", url: "" },
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath={routes.cms.bookmarks.index.href()}>
					<CMSBookmarksActionView {...view} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async update(ctx) {
			let user = authState().user;
			let bookmarkId = ctx.params.id;
			if (!user || !bookmarkId) {
				return redirect(routes.cms.bookmarks.index.href(), { status: redirect.Status.SeeOther });
			}

			let result = await validate(ctx.get(FormData), BookmarkSchema);
			succeeded(result, "Invalid bookmark form data");

			let updated = await LikePost.update(db(), bookmarkId, {
				author_id: user.id,
				meta: {
					title: result.data.title,
					url: result.data.url,
				},
			});

			if (!updated) return notFound("<h1>404 Not Found</h1>");

			return redirect(routes.cms.bookmarks.edit.href({ id: bookmarkId }), {
				status: redirect.Status.SeeOther,
			});
		},
	},
});
