import { redirect } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { authState } from "~/middleware/auth-state";
import { db } from "~/middleware/db";
import { LikePost } from "~/models/posts/like";
import { CMSBookmarksActionView, CMSBookmarksIndexView } from "~/views/cms/bookmarks";

export default controller<typeof routes.cms.bookmarks>({
	middleware: [],

	actions: {
		async index(ctx) {
			let bookmarks = await LikePost.findAll(db(ctx));
			let items = bookmarks.map((bookmark) => {
				return {
					id: bookmark.post.id,
					title: bookmark.meta.title,
					url: bookmark.meta.url,
					date: formatListDate(bookmark.post.created_at),
					href: `/cms/bookmarks/${bookmark.post.id}/edit`,
					editHref: `/cms/bookmarks/${bookmark.post.id}/edit`,
					showHref: `/cms/bookmarks/${bookmark.post.id}`,
					deleteAction: `/cms/bookmarks/${bookmark.post.id}`,
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
			let user = authState().user;
			if (!user) return redirect("/login", { status: redirect.Status.SeeOther });

			let formData = await ctx.request.formData();
			let created = await LikePost.create(db(ctx), {
				author_id: user.id,
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
				let view = {
					title: "Bookmark Not Found",
					description: `Bookmark ${ctx.params.id} was not found.`,
					mode: "new" as const,
					action: "/cms/bookmarks",
					submitLabel: "Create Bookmark",
					values: {
						title: "",
						url: "",
					},
				};
				let body = await renderToString(
					<CMSLayout title={view.title} activePath="/cms/bookmarks">
						<CMSBookmarksActionView {...(view as CMSBookmarksActionView.Props)} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let view = {
				title: `Edit Bookmark ${bookmark.meta.title}`,
				description: `Editing bookmark pointing to ${bookmark.meta.url}.`,
				mode: "edit" as const,
				action: `/cms/bookmarks/${bookmark.post.id}`,
				submitLabel: "Save Bookmark",
				deleteAction: `/cms/bookmarks/${bookmark.post.id}`,
				values: {
					title: bookmark.meta.title ?? "",
					url: bookmark.meta.url ?? "",
				},
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/bookmarks">
					<CMSBookmarksActionView {...(view as CMSBookmarksActionView.Props)} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async new(ctx) {
			let total = (await LikePost.findAll(db(ctx))).length;
			let view = {
				title: "New Bookmark",
				description: `New Bookmark form loaded. Current bookmarks count: ${total}.`,
				mode: "new" as const,
				action: "/cms/bookmarks",
				submitLabel: "Create Bookmark",
				values: {
					title: "",
					url: "",
				},
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/bookmarks">
					<CMSBookmarksActionView {...(view as CMSBookmarksActionView.Props)} />
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
			let user = authState().user;
			let bookmarkId = ctx.params.id;
			if (!user || !bookmarkId) {
				return redirect("/cms/bookmarks", { status: redirect.Status.SeeOther });
			}

			let formData = await ctx.request.formData();
			let updated = await LikePost.update(db(ctx), bookmarkId, {
				author_id: user.id,
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

function formatListDate(value: string) {
	let parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return "";
	return parsed.toISOString().slice(0, 10);
}
