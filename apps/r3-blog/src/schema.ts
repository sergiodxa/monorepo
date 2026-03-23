import type { AnyTable, TableRow } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

type InsertRow<table extends AnyTable> = Partial<TableRow<table>>;

const isoDate = s
	.string()
	.refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date format");

export const users = createTable({
	name: "users",
	primaryKey: ["id"],
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
	columns: {
		id: s.string(),
		created_at: isoDate,
		updated_at: isoDate,
		subject_id: s.optional(s.string()),
		role: s.defaulted(s.optional(s.enum_(["guest", "admin"])), "guest"),
		email: s.string(),
		avatar: s.string(),
		username: s.string(),
		display_name: s.string(),
	},
});

export const posts = createTable({
	name: "posts",
	primaryKey: ["id"],
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
	columns: {
		id: s.string(),
		created_at: isoDate,
		updated_at: isoDate,
		published_at: s.nullable(isoDate),
		author_id: s.string(),
		type: s.enum_(["like", "tutorial", "article", "comment", "glossary"]),
	},
});

export const postMeta = createTable({
	name: "post_meta",
	primaryKey: ["id"],
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
	columns: {
		id: s.string(),
		created_at: isoDate,
		updated_at: isoDate,
		post_id: s.string(),
		key: s.string(),
		value: s.string(),
	},
});

export type SelectUser = TableRow<typeof users>;
export type SelectPost = TableRow<typeof posts>;
export type SelectPostMeta = TableRow<typeof postMeta>;

export type InsertUser = InsertRow<typeof users>;
export type InsertPost = InsertRow<typeof posts>;
export type InsertPostMeta = InsertRow<typeof postMeta>;
