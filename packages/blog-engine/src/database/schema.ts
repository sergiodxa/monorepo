/**
 * Engine-owned database schema and its persisted row types. These `table()`
 * definitions drive the query layer; the physical DDL lives in the migration SQL in
 * {@link ./migrations.ts} and both must be kept in sync.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/**
 * Engine-owned database schema (WordPress-style `posts` + `post_meta` EAV, plus
 * runtime-defined post types, roles, users, settings, and SQL-backed sessions).
 *
 * These `table()` definitions drive the query layer (`new Database(adapter)`).
 * The physical DDL — indexes, foreign keys, cascade rules — lives in the SQL
 * migration strings in {@link ./migrations.ts}; both must be kept in sync.
 */

/** Core post row. Everything type-specific lives in {@link postMeta}. */
export const posts = table({
	name: "posts",
	primaryKey: ["id"],
	timestamps: true,
	columns: {
		id: c.text(),
		slug: c.text(),
		/** Machine name of the post type; validity enforced against {@link postTypes}. */
		type: c.text(),
		author_id: c.text(),
		/** NULL = draft; past = published; future = scheduled. */
		published_at: c.text().nullable(),
		created_at: c.text(),
		updated_at: c.text(),
	},
});

/** Key/value metadata attached to a post (one row per field). */
export const postMeta = table({
	name: "post_meta",
	primaryKey: ["id"],
	timestamps: true,
	columns: {
		id: c.text(),
		post_id: c.text(),
		key: c.text(),
		value: c.text(),
		created_at: c.text(),
		updated_at: c.text(),
	},
});

/** Runtime-defined post type with its JSON field definitions. */
export const postTypes = table({
	name: "post_types",
	primaryKey: ["id"],
	timestamps: true,
	columns: {
		id: c.text(),
		/** Machine name, singular (== posts.type), e.g. "article". */
		name: c.text(),
		/** Public URL segment, plural, e.g. "articles". */
		path: c.text(),
		label: c.text(),
		description: c.text(),
		/** JSON array of FieldDefinition. */
		fields: c.text(),
		/** 1 when shipped by the engine and protected from deletion/renaming. */
		builtin: c.integer(),
		/** 1 when the type participates in public routes/feed/rss/sitemap. */
		visible: c.integer(),
		created_at: c.text(),
		updated_at: c.text(),
	},
});

/** Blog-owner settings (site title/description, theme, custom CSS). JSON values. */
export const settings = table({
	name: "settings",
	primaryKey: ["key"],
	columns: {
		key: c.text(),
		/** JSON-encoded value. */
		value: c.text(),
		updated_at: c.text(),
	},
});

/** Runtime-defined role bundling permission keys from the engine catalog. */
export const roles = table({
	name: "roles",
	primaryKey: ["id"],
	timestamps: true,
	columns: {
		id: c.text(),
		name: c.text(),
		label: c.text(),
		description: c.text(),
		/** JSON array of permission keys. */
		permissions: c.text(),
		builtin: c.integer(),
		created_at: c.text(),
		updated_at: c.text(),
	},
});

/** Local user row; role mapping + byline for an OIDC subject. */
export const users = table({
	name: "users",
	primaryKey: ["id"],
	timestamps: true,
	columns: {
		id: c.text(),
		/** OIDC `sub`; nullable before the first login links it. */
		subject_id: c.text().nullable(),
		email: c.text(),
		role_id: c.text(),
		username: c.text(),
		display_name: c.text(),
		avatar: c.text(),
		created_at: c.text(),
		updated_at: c.text(),
	},
});

/** SQL-backed session store (the engine's only hard dependency stays one DB). */
export const sessions = table({
	name: "sessions",
	primaryKey: ["id"],
	timestamps: true,
	columns: {
		id: c.text(),
		/** JSON payload (userId, idToken, auth transaction). */
		data: c.text(),
		expires_at: c.text(),
		created_at: c.text(),
		updated_at: c.text(),
	},
});

/** Persisted post row. */
export type SelectPost = TableRow<typeof posts>;
/** Persisted post-meta row. */
export type SelectPostMeta = TableRow<typeof postMeta>;
/** Persisted post-type row. */
export type SelectPostType = TableRow<typeof postTypes>;
/** Persisted settings row. */
export type SelectSetting = TableRow<typeof settings>;
/** Persisted role row. */
export type SelectRole = TableRow<typeof roles>;
/** Persisted user row. */
export type SelectUser = TableRow<typeof users>;
/** Persisted session row. */
export type SelectSession = TableRow<typeof sessions>;
