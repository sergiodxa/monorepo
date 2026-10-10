/**
 * The reader's own copy of every post from the feeds they follow, with their read, saved and
 * flagged marks. Bulk materialization, the timeline walk and the retention sweeps run their
 * own statements; this model is the vocabulary single-post reads and counts are written in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { isNull, notNull } from "remix/data-table";

import { feedItems } from "~/database/schema";

/** One reader's posts, with scopes for the marks every count and single-post read filters on. */
export const Posts = createModel(feedItems, {
	scopes: {
		/** Posts the reader has not read. */
		unread: (query) => query.where(isNull("read_at")),
		/** Posts the reader kept, which no retention rule deletes. */
		saved: (query) => query.where(notNull("saved_at")),
		/** Posts from one subscription. */
		ofSubscription: (query, subscriptionId: string) => query.where({ feed_id: subscriptionId }),
	},
});

export default Posts;
