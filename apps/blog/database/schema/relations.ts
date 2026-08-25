/**
 * Declares the relational graph between the blog schema tables. Wires users to
 * their authored posts, posts to their author and metadata rows, and metadata
 * back to its owning post so repositories can traverse joins declaratively.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { belongsTo, hasMany } from "remix/data-table";

import { postMeta } from "./post-meta";
import { posts } from "./posts";
import { users } from "./users";

/**
 * Connects a user to the posts they authored via `author_id`.
 * Backs author pages and per-author post lists.
 */
export const userRelations = {
	posts: hasMany(users, posts, {
		foreignKey: "author_id",
		targetKey: "id",
	}),
};

/**
 * Connects each post to its author and metadata rows.
 * Centralizes post read-shapes used by repositories when rendering public content.
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
 * Connects each metadata entry back to its owning post through `post_id`.
 * Keeps metadata queries anchored to real posts and enables reverse lookups.
 */
export const postMetaRelations = {
	post: belongsTo(postMeta, posts, {
		foreignKey: "post_id",
		targetKey: "id",
	}),
};
