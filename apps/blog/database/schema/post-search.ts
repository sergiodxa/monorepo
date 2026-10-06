/**
 * Data-table schema for the `post_search` table: a search-only projection of each live
 * article, tutorial and glossary entry, holding just the text the FTS5 index `post_search_fts`
 * matches. `posts` and `post_meta` stay the source of truth for everything else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/**
 * One post's searchable text. `id` is the integer the FTS5 `rowid` mirrors, and `post_id`
 * joins back to `posts`, where kind and publish state are read at query time.
 */
export const postSearch = table({
	name: "post_search",
	columns: {
		id: c.integer().primaryKey(),
		post_id: c.text().references("posts", "id", "fk_post_search_post_id").onDelete("cascade"),
		/** The title a reader sees; a glossary entry's term followed by its alias. */
		title: c.text(),
		/** The post's tags as a JSON array of strings; `[]` for the untagged kinds. */
		tags: c.text(),
		/** The post's body as Markdown; a glossary entry's definition. */
		content: c.text(),
	},
});

/** Persisted search projection row. */
export type SelectPostSearch = TableRow<typeof postSearch>;
