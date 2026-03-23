import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { db } from "~/middleware/db";
import { LikePost } from "~/models/posts/like";
import { BookmarksView } from "~/views/bookmarks";

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
			let href = bookmark.meta.url;
			let label = bookmark.meta.title;
			let normalizedHref =
				href.startsWith("http://") || href.startsWith("https://") || href.startsWith("/")
					? href
					: `https://${href}`;
			let publishedAt = bookmark.post.published_at;
			let isPublished = publishedAt === null || Date.parse(publishedAt) <= Date.now();
			let suffixHref = normalizedHref.startsWith("http")
				? buildWayback(normalizedHref, bookmark.post.created_at)
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
