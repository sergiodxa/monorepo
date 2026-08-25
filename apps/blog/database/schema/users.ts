/**
 * Data-table schema for the `users` table. Defines local account profile fields
 * (email, username, avatar, display name) plus a guest/admin role and an optional
 * external `subject_id`, with validated audit timestamps for each record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import type { InsertRow } from "./types/insert-row";

import { validateTimestamps } from "./validations/timestamps";

/**
 * Stores local account profile data and authorization role.
 *
 * `subject_id` stays nullable so an account can exist before an external
 * auth subject is linked to it.
 */
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

/**
 * User record shape after persistence and table-level validation.
 */
export type SelectUser = TableRow<typeof users>;

/**
 * Payload shape accepted when creating a new user record.
 */
export type InsertUser = InsertRow<typeof users>;
