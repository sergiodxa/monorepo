import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { PostListPage } from "~/components/pages";
import { metaExternalUrl, metaTitle } from "~/lib/post-meta-view";
import { db } from "~/middleware/db";
import { LikePost } from "~/models/posts/like";

export default action<typeof routes.bookmarks>(async (ctx) => {
	let bookmarks = await LikePost.findAll(db(ctx));
	let buildWayback = (url: string, createdAt: string) => {
		let created = new Date(createdAt);
		if (Number.isNaN(created.getTime())) return null;

		let date = created
			.toISOString()
			.replaceAll("-", "")
			.replaceAll(":", "")
			.replaceAll(".", "")
			.replace("T", "");

		return `https://web.archive.org/web/${date}/${url}`;
	};

	let items = [...bookmarks]
		.sort((a, b) => {
			let aDate = Date.parse(a.post.published_at ?? a.post.created_at);
			let bDate = Date.parse(b.post.published_at ?? b.post.created_at);
			return bDate - aDate;
		})
		.map((bookmark) => {
			let href = metaExternalUrl(bookmark.meta) ?? "/bookmarks";
			let label = metaTitle(bookmark.meta, `Bookmark ${bookmark.post.id}`);
			let publishedAt = bookmark.post.published_at;
			let isPublished = publishedAt ? Date.parse(publishedAt) <= Date.now() : false;
			let suffixHref = href.startsWith("http")
				? buildWayback(href, bookmark.post.created_at)
				: null;

			return {
				href,
				label,
				preview: !isPublished,
				suffixHref: suffixHref ?? undefined,
				suffixLabel: suffixHref ? "Wayback Machine" : undefined,
			};
		});

	let body = await renderToString(
		<PostListPage
			title="Bookmarks"
			description="Links that I read and liked."
			activePath="/bookmarks"
			rssPath="/bookmarks.rss"
			items={items}
			emptyLabel="No bookmarks yet."
		/>,
	);

	return ok(body);
});
