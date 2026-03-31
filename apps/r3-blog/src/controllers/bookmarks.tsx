import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { db } from "~/middleware/db";
import { Post } from "~/models/post";
import { LikePost } from "~/models/posts/like";
import { BookmarksView } from "~/views/bookmarks";

export default action<typeof routes.bookmarks>(async () => {
	let bookmarks = await LikePost.findAll(db());

	let items = [...bookmarks]
		.sort((a, b) => Post.compareByPublishedOrCreatedDesc(a.post, b.post))
		.map((bookmark) => {
			let href = bookmark.meta.url;
			let label = bookmark.meta.title;
			let normalizedHref = LikePost.normalizeUrl(href);
			let isPublished = Post.isPublishedAt(bookmark.post.published_at);
			let suffixHref = normalizedHref.startsWith("http")
				? LikePost.waybackSnapshotUrl(normalizedHref, bookmark.post.created_at)
				: null;

			return {
				href,
				label,
				preview: !isPublished,
				suffixHref: suffixHref ?? undefined,
				suffixLabel: suffixHref ? "🏛️" : undefined,
				suffixAriaLabel: suffixHref ? "View on Wayback Machine" : undefined,
				suffixTitle: suffixHref ? "Wayback Machine" : undefined,
			};
		});

	let body = await renderToString(
		<BlogLayout
			title="Bookmarks"
			description="Links that I read and liked."
			activePath="/bookmarks"
		>
			<BookmarksView items={items} />
		</BlogLayout>,
	);

	return ok(body);
});
