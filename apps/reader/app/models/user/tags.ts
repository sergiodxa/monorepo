/**
 * The labels a reader puts on the posts they keep, unique per reader by their folded slug.
 * Every post holds a label by its id, so a rename writes one row, and deleting a label takes
 * it off every post while keeping the posts themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";

import { createModel } from "~/app/models/user/context";
import { tags } from "~/database/schema";

/** A reader's labels; deleting one removes it from every post in the same turn. */
export const Tags = createModel(tags, {
	generateId: () => TypeID.fromUUID("tag", generateUUID()).toString(),

	methods: {
		/** Every label, in the order their names read, which is the order the picker draws. */
		alphabetical() {
			return this.query().orderBy("name", "asc").all();
		},

		/** The label whose folded name is `slug`, or `null`. */
		bySlug(slug: string) {
			return this.findBy({ slug });
		},
	},

	callbacks: {
		/** Takes the label off every post before the label goes, so no join row outlives it. */
		async beforeDelete(tag, ctx) {
			await ctx.models.itemTags.ofTag(tag.id).delete();
		},
	},
});

export default Tags;
