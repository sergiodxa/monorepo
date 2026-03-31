import type { AnyTable, TableRow } from "remix/data-table";

import { belongsTo, column as c, fail, hasMany, table } from "remix/data-table";

type InsertRow<table extends AnyTable> = Partial<TableRow<table>>;

const ISO_UTC_MILLIS_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Users table definition.
 *
 * Stores identity and profile information for blog users.
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
 * Posts table definition.
 *
 * Stores authored content records and their publish scheduling state.
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
 * Post metadata table definition.
 *
 * Stores flexible key/value metadata attached to posts.
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
 * Relations that start from the users table.
 */
export const userRelations = {
	posts: hasMany(users, posts, {
		foreignKey: "author_id",
		targetKey: "id",
	}),
};

/**
 * Relations that start from the posts table.
 */
export const postRelations = {
	author: belongsTo(posts, users, {
		foreignKey: "author_id",
		targetKey: "id",
	}),
	meta: hasMany(posts, postMeta, {
		foreignKey: "post_id",
		targetKey: "id",
	}),
};

/**
 * Relations that start from the post_meta table.
 */
export const postMetaRelations = {
	post: belongsTo(postMeta, posts, {
		foreignKey: "post_id",
		targetKey: "id",
	}),
};

/**
 * Row shape returned when selecting from the users table.
 */
export type SelectUser = TableRow<typeof users>;

/**
 * Row shape returned when selecting from the posts table.
 */
export type SelectPost = TableRow<typeof posts>;

/**
 * Row shape returned when selecting from the post_meta table.
 */
export type SelectPostMeta = TableRow<typeof postMeta>;

/**
 * Input shape accepted when creating or updating users.
 */
export type InsertUser = InsertRow<typeof users>;

/**
 * Input shape accepted when creating or updating posts.
 */
export type InsertPost = InsertRow<typeof posts>;

/**
 * Input shape accepted when creating or updating post metadata rows.
 */
export type InsertPostMeta = InsertRow<typeof postMeta>;

function isIsoUtcMillis(value: string) {
	if (!ISO_UTC_MILLIS_REGEX.test(value)) return false;
	return !Number.isNaN(Date.parse(value));
}

function validateTimestamps(
	value: Record<string, unknown>,
	fields: Array<{ name: string; nullable: boolean }>,
) {
	let issues: Array<{ message: string; path: Array<string> }> = [];

	for (let field of fields) {
		if (!(field.name in value)) continue;

		let fieldValue = value[field.name];
		if (field.nullable && fieldValue === null) continue;

		if (typeof fieldValue !== "string" || !isIsoUtcMillis(fieldValue)) {
			issues.push({
				message: `Expected ${field.name} to be an ISO UTC timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)`,
				path: [field.name],
			});
		}
	}

	if (issues.length > 0) return fail(issues);
	return { value };
}
