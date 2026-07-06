/**
 * Database schema for the blog app. Defines the SQLite/D1 tables via Drizzle for
 * users, posts, and post_meta, along with their relations and inferred
 * select/insert types. The post/post_meta key-value split lets a single posts
 * table back every content type, and users link to auth.sergiodxa.com subjects
 * with a blog-specific role. This is the source of truth for the data model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { pk, timestamp } from "@pkg/db-helpers";
import { relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { UUID } from "~/utils/uuid";

import { generateUUID } from "~/utils/uuid";

const UUID_LENGTH = 36;

let id = pk("id").$type<UUID>().$defaultFn(generateUUID);
let createdAt = timestamp("created_at")
	.notNull()
	.$defaultFn(() => new Date());
let updatedAt = timestamp("updated_at")
	.notNull()
	.$defaultFn(() => new Date());

export let users = sqliteTable("users", {
	id,
	// Timestamps
	createdAt,
	updatedAt,
	// Link to auth.sergiodxa.com subject
	subjectId: text("subject_id", { mode: "text", length: UUID_LENGTH }).unique(),
	// Blog-specific authorization (NOT the same as auth app's role)
	role: text("role", { enum: ["guest", "admin"] })
		.notNull()
		.default("guest"),
	// Cached from ID token for display purposes
	email: text("email", { mode: "text", length: 320 }).notNull(),
	avatar: text("avatar", { mode: "text", length: 2048 }).notNull(),
	username: text("username", { mode: "text", length: 39 }).notNull(),
	displayName: text("display_name", { mode: "text", length: 255 }).notNull(),
});

export let posts = sqliteTable("posts", {
	id,
	// Timestamps
	createdAt,
	updatedAt,
	publishedAt: timestamp("published_at"),
	// Relations
	authorId: text("author_id", { mode: "text", length: UUID_LENGTH })
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	// Attributes
	type: text("type", {
		enum: ["like", "tutorial", "article", "comment", "glossary"],
		length: 255,
	}).notNull(),
});

export let postMeta = sqliteTable("post_meta", {
	id,
	// Timestamps
	createdAt,
	updatedAt,
	// Relations
	postId: text("post_id", { mode: "text", length: UUID_LENGTH })
		.notNull()
		.references(() => posts.id, { onDelete: "cascade" }),
	// Attribures
	key: text("key", { mode: "text", length: 255 }).notNull(),
	value: text("value", { mode: "text" }).notNull(),
});

export let usersRelation = relations(users, ({ many }) => {
	return {
		posts: many(posts),
	};
});

export let postRelation = relations(posts, ({ one, many }) => {
	return {
		author: one(users, { fields: [posts.authorId], references: [users.id] }),
		meta: many(postMeta),
	};
});

export let postMetaRelation = relations(postMeta, ({ one }) => {
	return {
		post: one(posts, { fields: [postMeta.postId], references: [posts.id] }),
	};
});

export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type SelectPost = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

export type SelectPostMeta = typeof postMeta.$inferSelect;
export type InsertPostMeta = typeof postMeta.$inferInsert;
