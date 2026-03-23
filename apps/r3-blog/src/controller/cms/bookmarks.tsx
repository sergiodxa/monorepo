import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { db } from "~/middleware/db";
import { LikePost } from "~/models/posts/like";
import { CMSBookmarksActionView, CMSBookmarksIndexView } from "~/views/cms/bookmarks";

namespace CMSBookmarksController {
	export interface ActionViewProps {
		title: string;
		description: string;
	}
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
			let total = (await LikePost.findAll(db(ctx))).length;
			let view: CMSBookmarksController.ActionViewProps = {
				title: "Create Bookmark",
				description: `Create Bookmark. There are currently ${total} bookmarks in the database.`,
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/bookmarks">
					<CMSBookmarksActionView title={view.title} description={view.description} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async destroy(ctx) {
			let bookmark = await LikePost.findById(db(ctx), ctx.params.id);
			if (!bookmark) {
				let view: CMSBookmarksController.ActionViewProps = {
					title: "Bookmark Not Found",
					description: `Bookmark ${ctx.params.id} was not found.`,
				};
				let body = await renderToString(
					<CMSLayout title={view.title} activePath="/cms/bookmarks">
						<CMSBookmarksActionView title={view.title} description={view.description} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = bookmark.meta.title;
			let view: CMSBookmarksController.ActionViewProps = {
				title: `Delete Bookmark ${title}`,
				description: `Ready to delete bookmark "${title}" (${bookmark.post.id}).`,
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/bookmarks">
					<CMSBookmarksActionView title={view.title} description={view.description} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async edit(ctx) {
			let bookmark = await LikePost.findById(db(ctx), ctx.params.id);
			if (!bookmark) {
				let view: CMSBookmarksController.ActionViewProps = {
					title: "Bookmark Not Found",
					description: `Bookmark ${ctx.params.id} was not found.`,
				};
				let body = await renderToString(
					<CMSLayout title={view.title} activePath="/cms/bookmarks">
						<CMSBookmarksActionView title={view.title} description={view.description} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = bookmark.meta.title;
			let url = bookmark.meta.url;
			let view: CMSBookmarksController.ActionViewProps = {
				title: `Edit Bookmark ${title}`,
				description: `Editing bookmark "${title}" pointing to ${url}.`,
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/bookmarks">
					<CMSBookmarksActionView title={view.title} description={view.description} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async new(ctx) {
			let total = (await LikePost.findAll(db(ctx))).length;
			let view: CMSBookmarksController.ActionViewProps = {
				title: "New Bookmark",
				description: `New Bookmark form loaded. Current bookmarks count: ${total}.`,
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/bookmarks">
					<CMSBookmarksActionView title={view.title} description={view.description} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async show(ctx) {
			let bookmark = await LikePost.findById(db(ctx), ctx.params.id);
			if (!bookmark) {
				let view: CMSBookmarksController.ActionViewProps = {
					title: "Bookmark Not Found",
					description: `Bookmark ${ctx.params.id} was not found.`,
				};
				let body = await renderToString(
					<CMSLayout title={view.title} activePath="/cms/bookmarks">
						<CMSBookmarksActionView title={view.title} description={view.description} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let view: CMSBookmarksController.ActionViewProps = {
				title: bookmark.meta.title,
				description: `Bookmark ${bookmark.post.id} links to ${bookmark.meta.url}.`,
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/bookmarks">
					<CMSBookmarksActionView title={view.title} description={view.description} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async update(ctx) {
			let bookmark = await LikePost.findById(db(ctx), ctx.params.id);
			if (!bookmark) {
				let view: CMSBookmarksController.ActionViewProps = {
					title: "Bookmark Not Found",
					description: `Bookmark ${ctx.params.id} was not found.`,
				};
				let body = await renderToString(
					<CMSLayout title={view.title} activePath="/cms/bookmarks">
						<CMSBookmarksActionView title={view.title} description={view.description} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = bookmark.meta.title;
			let view: CMSBookmarksController.ActionViewProps = {
				title: `Update Bookmark ${title}`,
				description: `Update flow loaded for bookmark "${title}" (${bookmark.post.id}).`,
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/bookmarks">
					<CMSBookmarksActionView title={view.title} description={view.description} />
				</CMSLayout>,
			);
			return ok(body);
		},
	},
});
