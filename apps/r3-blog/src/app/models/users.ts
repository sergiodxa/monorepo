import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import type { InsertRow } from "./shared";

import { validateTimestamps } from "./shared";

export const users = table({
	name: "users",
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
	columns: {
		id: c.text().primaryKey(),
		created_at: c.text(),
		updated_at: c.text(),
		subject_id: c.text().nullable(),
		role: c.enum(["guest", "admin"]).default("guest"),
		email: c.text(),
		avatar: c.text(),
		username: c.text(),
		display_name: c.text(),
	},
	validate({ value }) {
		return validateTimestamps(value, [
			{ name: "created_at", nullable: false },
			{ name: "updated_at", nullable: false },
		]);
	},
});

export type SelectUser = TableRow<typeof users>;

export type InsertUser = InsertRow<typeof users>;
