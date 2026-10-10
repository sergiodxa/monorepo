/**
 * The searches a reader keeps: a name, the query words, a read state and an optional feed.
 * The row holds a narrowing rather than a result, so rewriting one changes the address the
 * rail draws and nothing else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";

import { searches } from "~/database/schema";

/** A reader's saved searches, listed in the order their names read. */
export const Searches = createModel(searches, {
	optional: ["id"],

	methods: {
		/** Every saved search, in the order their names read, which is the order of the rail. */
		alphabetical() {
			return this.query().orderBy("name", "asc").orderBy("id", "asc").all();
		},

		/** The saved search by that exact name, or `null`. */
		byName(name: string) {
			return this.findBy({ name });
		},
	},

	callbacks: {
		/** Mints the id the saved search's address carries. */
		async beforeCreate(values) {
			return { ...values, id: values.id ?? TypeID.fromUUID("search", generateUUID()).toString() };
		},
	},
});

export default Searches;
