import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import type { InsertRow } from "./types/insert-row";

import { validateTimestamps } from "./validations/timestamps";

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

export type SelectPostMeta = TableRow<typeof postMeta>;

export type InsertPostMeta = InsertRow<typeof postMeta>;
