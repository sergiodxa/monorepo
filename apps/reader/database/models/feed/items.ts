/**
 * The items one feed holds, read the two ways a subscriber reaches them: the newest page,
 * handed over on a follow, and the revisions above a cursor, walked oldest first so a
 * reader applies them in the order this feed decided them and can stop anywhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { gt } from "remix/data-table";

import type { SelectItem } from "~/database/feed-schema";

import { items } from "~/database/feed-schema";

/** The feed's canonical items, which every subscriber copies from. */
export const Items = createModel(items, {
	scopes: {
		/** The items decided after `revision`, which a subscriber's cursor has not reached. */
		after: (query, revision: number) => query.where(gt("revision", revision)),
	},

	methods: {
		/**
		 * Up to `limit` items above `cursor`, oldest revision first.
		 *
		 * @param cursor - The greatest revision the caller has already ruled on.
		 */
		pageAfter(cursor: number, limit: number): Promise<SelectItem[]> {
			return this.after(cursor).orderBy("revision", "asc").limit(limit).all();
		},

		/** The `limit` most recently published items, ties broken by id so a page is stable. */
		newest(limit: number): Promise<SelectItem[]> {
			return this.query().orderBy("published_at", "desc").orderBy("id", "desc").limit(limit).all();
		},
	},
});

export default Items;
