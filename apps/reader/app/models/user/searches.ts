/**
 * The searches a reader keeps: a name, the query words, a read state and an optional feed.
 * The row holds a narrowing rather than a result, so rewriting one changes the address the
 * rail draws and nothing else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";

import { createModel } from "~/app/models/user/context";
import { searches } from "~/database/schema";

/** A reader's saved searches, listed in the order their names read. */
export const Searches = createModel(searches, {
	generateId: () => TypeID.fromUUID("search", generateUUID()).toString(),

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
});

export default Searches;
