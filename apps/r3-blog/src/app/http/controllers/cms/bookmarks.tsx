import { notFound } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { renderToString } from "remix/component/server";
import { defaulted, object, string } from "remix/data-schema";

import { db } from "~/app/http/middleware/db";
import { createCMSCrudActions } from "~/app/http/support/cms/crud";
import { LikePost } from "~/app/repositories/posts/like";
import { CMSLayout } from "~/components/layout/cms";
import routes from "~/routes";
import { CMSBookmarksActionView, CMSBookmarksIndexView } from "~/views/cms/bookmarks";

let BookmarkSchema = object({
	title: defaulted(string(), "Untitled bookmark"),
	url: defaulted(string(), "/"),
});

export default controller<typeof routes.cms.bookmarks>({
	middleware: [],

	actions: createCMSCrudActions({
		model: LikePost,
		paths: {
			indexHref: routes.cms.bookmarks.index.href(),
			loginHref: routes.auth.login.index.href(),
			editHref(id) {
				return routes.cms.bookmarks.edit.href({ id });
			},
		},
		index: {
			mapItems(bookmarks) {
				return bookmarks.map((bookmark) => ({
					id: bookmark.id,
					title: bookmark.meta.title,
					url: bookmark.meta.url,
					href: routes.cms.bookmarks.edit.href({ id: bookmark.id }),
					deleteAction: routes.cms.bookmarks.destroy.href({ id: bookmark.id }),
				}));
			},
			async render(items) {
				return renderToString(
					<CMSLayout title="Bookmarks" activePath={routes.cms.bookmarks.index.href()}>
						<CMSBookmarksIndexView items={items} />
					</CMSLayout>,
				);
			},
		},
		action: {
			buildEditProps(bookmark): CMSBookmarksActionView.Props {
				return {
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
			},
			buildNotFoundProps(id): CMSBookmarksActionView.Props {
				return {
					title: "Bookmark Not Found",
					description: `Bookmark ${id} was not found.`,
					mode: "new",
					action: routes.cms.bookmarks.index.href(),
					submitLabel: "Create Bookmark",
					values: { title: "", url: "" },
				};
			},
			async buildNewProps(): Promise<CMSBookmarksActionView.Props> {
				let total = (await LikePost.findAll(db())).length;
				return {
					title: "New Bookmark",
					description: `New Bookmark form loaded. Current bookmarks count: ${total}.`,
					mode: "new",
					action: routes.cms.bookmarks.index.href(),
					submitLabel: "Create Bookmark",
					values: { title: "", url: "" },
				};
			},
			async render(view) {
				return renderToString(
					<CMSLayout title={view.title} activePath={routes.cms.bookmarks.index.href()}>
						<CMSBookmarksActionView {...view} />
					</CMSLayout>,
				);
			},
		},
		form: {
			async parse(formData) {
				let result = await validate(formData, BookmarkSchema);
				succeeded(result, "Invalid bookmark form data");
				return result.data;
			},
			toCreateInput(data, user) {
				return {
					author_id: user.id,
					meta: {
						title: data.title,
						url: data.url,
					},
				};
			},
			toUpdateInput(data, user) {
				return {
					author_id: user.id,
					meta: {
						title: data.title,
						url: data.url,
					},
				};
			},
		},
		onUpdateMissing() {
			return notFound("<h1>404 Not Found</h1>");
		},
	}),
});
