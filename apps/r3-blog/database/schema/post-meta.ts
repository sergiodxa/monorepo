/**
 * Data-table schema for the `post_meta` table. Defines extensible key-value
 * metadata rows attached to posts via a cascading `post_id` foreign key, with
 * validated audit timestamps, letting posts carry arbitrary structured extras.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import type { InsertRow } from "./types/insert-row";

import { validateTimestamps } from "./validations/timestamps";

/**
 * Stores extensible key-value metadata for posts.
 *
 * Child rows are removed when their parent post is deleted, and timestamp
 * fields are validated as required audit columns.
 */
export const postMeta = table({
	name: "post_meta",
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
	columns: {
		id: c.text().primaryKey(),
		created_at: c.text(),
		updated_at: c.text(),
		post_id: c.text().references("posts", "id", "fk_post_meta_post_id").onDelete("cascade"),
		key: c.text(),
		value: c.text(),
	},
	validate({ value }) {
		return validateTimestamps(value, [
			{ name: "created_at", nullable: false },
			{ name: "updated_at", nullable: false },
		]);
	},
});

/**
 * Database row shape returned when reading post metadata.
 */
export type SelectPostMeta = TableRow<typeof postMeta>;

/**
 * Insert payload shape for creating post metadata records.
 */
export type InsertPostMeta = InsertRow<typeof postMeta>;
