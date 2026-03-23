import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSActionPage, CMSResourcePage } from "~/components/cms-pages";
import { metaExternalUrl, metaTitle } from "~/lib/post-meta-view";
import { db } from "~/middleware/db";
import { LikePost } from "~/models/posts/like";

function render(title: string, activePath: string, description: string) {
	return renderToString(
		<CMSActionPage title={title} activePath={activePath} description={description} />,
	);
}

export default controller<typeof routes.cms.bookmarks>({
	middleware: [],

	actions: {
		async index(ctx) {
			let bookmarks = await LikePost.findAll(db(ctx));
			let items = bookmarks.map((bookmark) => {
				let title = metaTitle(bookmark.meta, `Bookmark ${bookmark.post.id}`);
				let url = metaExternalUrl(bookmark.meta) ?? "/bookmarks";
				return {
					label: `${title} -> ${url}`,
					href: `/cms/bookmarks/${bookmark.post.id}`,
				};
			});

			let body = await renderToString(
				<CMSResourcePage
					title="Bookmarks"
					activePath="/cms/bookmarks"
					searchLabel="What're you looking for?"
					searchCta="Search"
					primaryCta={{ href: "/cms/bookmarks/new", label: "New Bookmark" }}
					items={items}
					emptyLabel="No bookmarks found in the database yet."
				/>,
			);
			return ok(body);
		},

		async create(ctx) {
			let total = (await LikePost.findAll(db(ctx))).length;
			let body = await render(
				"Create Bookmark",
				"/cms/bookmarks",
				`Create Bookmark. There are currently ${total} bookmarks in the database.`,
			);
			return ok(body);
		},

		async destroy(ctx) {
			let bookmark = await LikePost.findById(db(ctx), ctx.params.id);
			if (!bookmark) {
				let body = await render(
					"Bookmark Not Found",
					"/cms/bookmarks",
					`Bookmark ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let title = metaTitle(bookmark.meta, bookmark.post.id);
			let body = await render(
				`Delete Bookmark ${title}`,
				"/cms/bookmarks",
				`Ready to delete bookmark "${title}" (${bookmark.post.id}).`,
			);
			return ok(body);
		},

		async edit(ctx) {
			let bookmark = await LikePost.findById(db(ctx), ctx.params.id);
			if (!bookmark) {
				let body = await render(
					"Bookmark Not Found",
					"/cms/bookmarks",
					`Bookmark ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let title = metaTitle(bookmark.meta, bookmark.post.id);
			let url = metaExternalUrl(bookmark.meta) ?? "no-url";
			let body = await render(
				`Edit Bookmark ${title}`,
				"/cms/bookmarks",
				`Editing bookmark "${title}" pointing to ${url}.`,
			);
			return ok(body);
		},

		async new(ctx) {
			let total = (await LikePost.findAll(db(ctx))).length;
			let body = await render(
				"New Bookmark",
				"/cms/bookmarks",
				`New Bookmark form loaded. Current bookmarks count: ${total}.`,
			);
			return ok(body);
		},

		async show(ctx) {
			let bookmark = await LikePost.findById(db(ctx), ctx.params.id);
			if (!bookmark) {
				let body = await render(
					"Bookmark Not Found",
					"/cms/bookmarks",
					`Bookmark ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let body = await render(
				metaTitle(bookmark.meta, `Bookmark ${bookmark.post.id}`),
				"/cms/bookmarks",
				`Bookmark ${bookmark.post.id} links to ${metaExternalUrl(bookmark.meta) ?? "no-url"}.`,
			);
			return ok(body);
		},

		async update(ctx) {
			let bookmark = await LikePost.findById(db(ctx), ctx.params.id);
			if (!bookmark) {
				let body = await render(
					"Bookmark Not Found",
					"/cms/bookmarks",
					`Bookmark ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let title = metaTitle(bookmark.meta, bookmark.post.id);
			let body = await render(
				`Update Bookmark ${title}`,
				"/cms/bookmarks",
				`Update flow loaded for bookmark "${title}" (${bookmark.post.id}).`,
			);
			return ok(body);
		},
	},
});
