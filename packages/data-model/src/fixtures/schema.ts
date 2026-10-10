/**
 * A blog-shaped schema the tests run on: users, posts that share one table across post types,
 * a key/value `post_meta` companion and comments, with foreign keys and a unique index on email.
 * It imports nothing runtime-specific, so the Workers pool applies it to a real D1 binding too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { column as c, hasMany, table } from "remix/data-table";

/** Users, soft-deleted through `deleted_at`, with email unique. */
export const users = table({
	name: "users",
	columns: {
		id: c.text().primaryKey(),
		email: c.text(),
		name: c.text(),
		role: c.enum(["member", "admin"] as const),
		deleted_at: c.text().nullable(),
		created_at: c.text(),
		updated_at: c.text(),
	},
	timestamps: true,
});

/** Every post type in one table, discriminated by `type`. */
export const posts = table({
	name: "posts",
	columns: {
		id: c.text().primaryKey(),
		type: c.enum(["article", "like", "tutorial"] as const),
		author_id: c.text(),
		published_at: c.text().nullable(),
		deleted_at: c.text().nullable(),
		federated_at: c.text().nullable(),
		created_at: c.text(),
		updated_at: c.text(),
	},
	timestamps: true,
});

/** Open-ended post attributes, one row per key or list item. */
export const postMeta = table({
	name: "post_meta",
	columns: {
		id: c.text().primaryKey(),
		post_id: c.text(),
		key: c.text(),
		value: c.text(),
		created_at: c.text(),
		updated_at: c.text(),
	},
	timestamps: true,
});

/** Comments on posts. */
export const comments = table({
	name: "comments",
	columns: {
		id: c.text().primaryKey(),
		post_id: c.text(),
		body: c.text(),
		created_at: c.text(),
		updated_at: c.text(),
	},
	timestamps: true,
});

/** A post's comments, for eager loading. */
export const postComments = hasMany(posts, comments, { foreignKey: "post_id" });

/** The schema's DDL, one statement per entry, the way D1 needs it applied. */
export const SCHEMA_STATEMENTS: readonly string[] = `
	create table users (
		id text primary key,
		email text not null,
		name text not null,
		role text not null,
		deleted_at text,
		created_at text not null,
		updated_at text not null
	);
	create unique index idx_users_email on users (email);
	create table posts (
		id text primary key,
		type text not null,
		author_id text not null references users (id),
		published_at text,
		deleted_at text,
		federated_at text,
		created_at text not null,
		updated_at text not null
	);
	create table post_meta (
		id text primary key,
		post_id text not null references posts (id) on delete cascade,
		key text not null,
		value text not null,
		created_at text not null,
		updated_at text not null
	);
	create index idx_post_meta_key_value on post_meta (key, value);
	create table comments (
		id text primary key,
		post_id text not null references posts (id) on delete cascade,
		body text not null,
		created_at text not null,
		updated_at text not null
	)
`
	.split(";")
	.map((statement) => statement.trim().replaceAll(/\s+/g, " "))
	.filter((statement) => statement !== "");

/** Numbered ids in creation order, so the tiebreaker on `id` agrees with insertion order. */
export function createIds(prefix = "id"): () => string {
	let next = 0;
	return () => `${prefix}_${String(++next).padStart(4, "0")}`;
}

/**
 * A clock answering ISO strings that advance one millisecond per read, so rows written in one
 * test still order by their timestamps and every adapter binds them as text.
 */
export function createClock(): () => string {
	let tick = Date.parse("2026-01-01T00:00:00.000Z");
	return () => new Date(tick++).toISOString();
}
