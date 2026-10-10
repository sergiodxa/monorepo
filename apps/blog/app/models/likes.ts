/**
 * Likes: the bookmarks listed on `/bookmarks`, each a page saved with its title, description
 * and, once captured, the instant the Wayback Machine archived it. Deleting one forgets its
 * bookmark row, which frees the page's address for a later save.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { field } from "@sdxc/data-model";
import { sql } from "remix/data-table";

import { Posts } from "./posts";

export const Likes = Posts.extend("like", {
	meta: {
		/** Empty until one is typed or read from the page; `bookmarkLabel()` covers it. */
		title: field.text().required().default(""),
		url: field.text().required().default(""),
		/** The page's own summary or its opening; empty until one is typed or read. */
		description: field.text().default(""),
		/** The Wayback Machine capture's instant (ISO 8601); empty until one is recorded. */
		archived_at: field.text().default(""),
	},

	methods: {
		/** Every live bookmark, newest first by creation. */
		findAll() {
			return this.newest().all();
		},

		/**
		 * Deletes a bookmark: tombstones its post and forgets its bookmark row.
		 *
		 * @returns Whether a live bookmark was deleted.
		 */
		async destroy(id: string): Promise<boolean> {
			let destroyed = await this.tombstone(id);
			await this.db.exec(sql`delete from "bookmarks" where "post_id" = ${id}`);
			return destroyed;
		},
	},
});

/** A bookmark, as reads return it. */
export type Like = ModelRow<typeof Likes>;

export default Likes;
