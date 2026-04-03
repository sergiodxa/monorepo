import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import type { InsertRow } from "./types/insert-row";

import { validateTimestamps } from "./validations/timestamps";

/**
 * Canonical post record shared by public content and internal post-like entities.
 * Enforces author integrity, constrains valid post kinds, and accepts nullable
 * `published_at` so repositories can model immediate publish vs scheduled preview.
 */
export const posts = table({
	name: "posts",
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
	columns: {
		id: c.text().primaryKey(),
		created_at: c.text(),
		updated_at: c.text(),
		author_id: c.text().references("users", "id", "fk_posts_author_id").onDelete("cascade"),
		type: c.enum(["like", "tutorial", "article", "comment", "glossary"]),
		published_at: c.text().nullable(),
	},
	validate({ value }) {
		return validateTimestamps(value, [
			{ name: "created_at", nullable: false },
			{ name: "updated_at", nullable: false },
			{ name: "published_at", nullable: true },
		]);
	},
});

/**
 * Persisted post shape returned by repository reads.
 */
export type SelectPost = TableRow<typeof posts>;

/**
 * Insert payload contract for creating post records.
 */
export type InsertPost = InsertRow<typeof posts>;
