/**
 * The feeds a reader follows, one row per feed with the reader's own answers about it: its
 * folder, its velocity, its pin and the cursor into the feed's revisions. A row outlives an
 * unfollow while saved posts still hold it, so "followed" is a scope rather than existence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";
import { isNull, notNull } from "remix/data-table";

import type { SelectFeed } from "~/database/schema";

import { feeds } from "~/database/schema";

/** The columns a subscription write may change; the key and the timestamps are the table's. */
export interface SubscriptionChanges extends Partial<
	Omit<SelectFeed, "id" | "created_at" | "updated_at">
> {}

/** A reader's subscriptions, followed or kept only to name the feed of their saved posts. */
export const Subscriptions = createModel(feeds, {
	optional: ["id", "cursor", "velocity", "notify", "presentation", "keep_link_parameters"],

	scopes: {
		/** Subscriptions the reader still follows, which every list and sweep starts from. */
		followed: (query) => query.where(isNull("unfollowed_at")),
		/** Subscriptions the reader pinned above the river. */
		pinned: (query) => query.where(notNull("pinned_at")),
		/** Subscriptions filed in one folder. */
		inFolder: (query, folderId: string) => query.where({ folder_id: folderId }),
		/** Followed subscriptions the reader asked to be notified about. */
		notified: (query) => query.where(isNull("unfollowed_at")).where({ notify: true }),
	},

	methods: {
		/** The subscription to a feed address, followed or not, or `null` for a new one. */
		byUrl(feedUrl: string) {
			return this.findBy({ feed_url: feedUrl });
		},

		/**
		 * Writes `changes` onto one subscription and answers it as stored. The caller has just
		 * read the row, so a missing one is a programming error rather than a refusal.
		 */
		async write(id: string, changes: SubscriptionChanges): Promise<SelectFeed> {
			return unwrap(await this.update({ id }, changes));
		},
	},

	callbacks: {
		/** Mints the id every post, rule and saved search holds the subscription by. */
		async beforeCreate(values) {
			return { ...values, id: values.id ?? TypeID.fromUUID("feed", generateUUID()).toString() };
		},
	},
});

export default Subscriptions;
