import { redirect } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { db } from "~/middleware/db";
import { LikePost } from "~/models/posts/like";
import { CMSBookmarksActionView, CMSBookmarksIndexView } from "~/views/cms/bookmarks";

namespace CMSBookmarksController {
	export interface ActionViewProps extends CMSBookmarksActionView.Props {}
}

export default controller<typeof routes.cms.bookmarks>({
	middleware: [],

	actions: {
		async index(ctx) {
			let bookmarks = await LikePost.findAll(db(ctx));
			let items: Array<CMSBookmarksIndexView.Item> = bookmarks.map((bookmark) => {
				return {
					id: bookmark.post.id,
					title: bookmark.meta.title,
					url: bookmark.meta.url,
					href: `/cms/bookmarks/${bookmark.post.id}/edit`,
				};
			});

			let body = await renderToString(
				<CMSLayout title="Bookmarks" activePath="/cms/bookmarks">
					<CMSBookmarksIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(ctx) {
			let user = ctx.auth.user;
			if (!user) return redirect("/login", { status: redirect.Status.SeeOther });

			let formData = await ctx.request.formData();
			let created = await LikePost.create(db(ctx), {
				author_id: user.id,
				published_at: parsePublishedAt(formData),
				meta: {
					title: readString(formData, "title") || "Untitled bookmark",
					url: readString(formData, "url") || "/",
				},
			});
			if (!created) return redirect("/cms/bookmarks", { status: redirect.Status.SeeOther });

			return redirect(`/cms/bookmarks/${created.post.id}/edit`, {
				status: redirect.Status.SeeOther,
			});
		},

		async destroy(ctx) {
			let bookmarkId = ctx.params.id;
			if (!bookmarkId) return redirect("/cms/bookmarks", { status: redirect.Status.SeeOther });

			await LikePost.destroy(db(ctx), bookmarkId);
			return redirect("/cms/bookmarks", { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let bookmark = await LikePost.findById(db(ctx), ctx.params.id);
			if (!bookmark) {
				let view: CMSBookmarksController.ActionViewProps = {
					title: "Bookmark Not Found",
					description: `Bookmark ${ctx.params.id} was not found.`,
					mode: "new",
					action: "/cms/bookmarks",
					submitLabel: "Create Bookmark",
					values: {
						title: "",
						url: "",
						published_at: "",
					},
				};
				let body = await renderToString(
					<CMSLayout title={view.title} activePath="/cms/bookmarks">
						<CMSBookmarksActionView {...view} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let view: CMSBookmarksController.ActionViewProps = {
				title: `Edit Bookmark ${bookmark.meta.title}`,
				description: `Editing bookmark pointing to ${bookmark.meta.url}.`,
				mode: "edit",
				action: `/cms/bookmarks/${bookmark.post.id}`,
				submitLabel: "Save Bookmark",
				deleteAction: `/cms/bookmarks/${bookmark.post.id}`,
				values: {
					title: bookmark.meta.title,
					url: bookmark.meta.url,
					published_at: bookmark.post.published_at ?? "",
				},
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/bookmarks">
					<CMSBookmarksActionView {...view} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async new(ctx) {
			let total = (await LikePost.findAll(db(ctx))).length;
			let view: CMSBookmarksController.ActionViewProps = {
				title: "New Bookmark",
				description: `New Bookmark form loaded. Current bookmarks count: ${total}.`,
				mode: "new",
				action: "/cms/bookmarks",
				submitLabel: "Create Bookmark",
				values: {
					title: "",
					url: "",
					published_at: "",
				},
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/bookmarks">
					<CMSBookmarksActionView {...view} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async show(ctx) {
			let bookmark = await LikePost.findById(db(ctx), ctx.params.id);
			if (!bookmark) return notFound("<h1>404 Not Found</h1>");

			return redirect(LikePost.normalizeUrl(bookmark.meta.url), {
				status: redirect.Status.SeeOther,
			});
		},

		async update(ctx) {
			let user = ctx.auth.user;
			let bookmarkId = ctx.params.id;
			if (!user || !bookmarkId) {
				return redirect("/cms/bookmarks", { status: redirect.Status.SeeOther });
			}

			let formData = await ctx.request.formData();
			let updated = await LikePost.update(db(ctx), bookmarkId, {
				author_id: user.id,
				published_at: parsePublishedAt(formData),
				meta: {
					title: readString(formData, "title") || "Untitled bookmark",
					url: readString(formData, "url") || "/",
				},
			});

			if (!updated) return notFound("<h1>404 Not Found</h1>");

			return redirect(`/cms/bookmarks/${bookmarkId}/edit`, { status: redirect.Status.SeeOther });
		},
	},
});

function readString(formData: FormData, key: string) {
	let value = formData.get(key);
	if (typeof value !== "string") return "";
	return value.trim();
}

function parsePublishedAt(formData: FormData) {
	let value = readString(formData, "published_at");
	if (!value) return null;
	if (Number.isNaN(Date.parse(value))) return null;
	return value;
}
