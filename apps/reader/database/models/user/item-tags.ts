/**
 * Which label is on which post, keyed by both. Each row copies the post's `published_at`, so
 * a label's page seeks down the join table's own index; the timeline query over it stays a
 * hand-written statement, and this model covers applying, removing and counting labels.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { inList } from "remix/data-table";

import { itemTags } from "~/database/schema";

/** The label-to-post join rows, keyed by `tag_id` and `item_id`. */
export const ItemTags = createModel(itemTags, {
	scopes: {
		/** The labels on one post. */
		onPost: (query, itemId: string) => query.where({ item_id: itemId }),
		/** The posts under one label. */
		ofTag: (query, tagId: string) => query.where({ tag_id: tagId }),
		/** The labels on a batch of posts, sized by the caller under the bind limit. */
		onPosts: (query, itemIds: readonly string[]) => query.where(inList("item_id", [...itemIds])),
	},

	callbacks: {
		/** Stamps when the label went on, since the join table keeps no managed timestamps. */
		async beforeCreate(values) {
			return { ...values, created_at: values.created_at ?? Date.now() };
		},
	},
});

export default ItemTags;
