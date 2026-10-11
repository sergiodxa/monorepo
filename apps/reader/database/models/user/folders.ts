/**
 * The folders a reader files feeds into: a name and nothing else, unique per reader. A post
 * carries its subscription's folder so a folder's page is one seek, which is why deleting a
 * folder unfiles both the subscriptions and the posts filed under it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";

import type { SelectFolder } from "~/database/schema";

import { folders } from "~/database/schema";

import { createModel } from "./context";

/** A reader's folders; deleting one unfiles its subscriptions and posts in the same turn. */
export const Folders = createModel(folders, {
	optional: ["id"],

	methods: {
		/** Every folder, in the order their names read, which is the order the rail draws. */
		alphabetical() {
			return this.query().orderBy("title", "asc").all();
		},

		/** The folder by that exact title, or `null`. */
		byTitle(title: string) {
			return this.findBy({ title });
		},

		/**
		 * The folder by that exact title, made when the reader has none by it, so filing by
		 * name is idempotent: a document naming one folder over twenty feeds creates it once.
		 */
		async findOrCreate(title: string): Promise<SelectFolder> {
			let id = TypeID.fromUUID("folder", generateUUID()).toString();
			return unwrap(await this.upsert({ id, title }, { conflict: ["title"], update: {} }));
		},
	},

	callbacks: {
		/** Mints the id every subscription and post holds the folder by. */
		async beforeCreate(values) {
			return { ...values, id: values.id ?? TypeID.fromUUID("folder", generateUUID()).toString() };
		},

		/**
		 * Unfiles the folder's subscriptions and their posts, so deleting a folder deletes no
		 * post and leaves its feeds exactly as they were before anybody made it.
		 */
		async beforeDelete(folder, ctx) {
			await ctx.models.subscriptions.inFolder(folder.id).update({ folder_id: null });
			await ctx.models.posts.query().where({ folder_id: folder.id }).update({ folder_id: null });
		},
	},
});

export default Folders;
