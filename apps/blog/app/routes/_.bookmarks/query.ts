/**
 * Data helper for the bookmarks route. queryBookmarks lists all Like records and
 * maps each to a title, url and a computed Wayback Machine archive URL derived from
 * the bookmark's creation timestamp. It exists to keep the bookmarks route's data
 * fetching and archive-link formatting out of the route module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getDB } from "~/middleware/drizzle";
import { Like } from "~/models/like.server";

export async function queryBookmarks() {
	let bookmarks = await Like.list({ db: getDB() });
	return bookmarks.map((article) => {
		let date = article.createdAt
			.toISOString()
			.replaceAll("-", "")
			.replaceAll(":", "")
			.replaceAll(".", "")
			.replace("T", "");

		let url = article.url.toString();

		let cached = `https://web.archive.org/web/${date}/${url}`;

		return { title: article.title, url, cached };
	});
}
