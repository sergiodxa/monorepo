/**
 * Barrel module for the blog database schema. Re-exports the posts, post_meta,
 * and users tables, their relation definitions, and the select/insert row types,
 * giving repositories one import point for the whole schema surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Re-exports module members.
 */
export { postMeta } from "./post-meta";
/**
 * Exports a module member.
 */
export type { InsertPostMeta, SelectPostMeta } from "./post-meta";
/**
 * Re-exports module members.
 */
export { postMetaRelations, postRelations, userRelations } from "./relations";
/**
 * Re-exports module members.
 */
export { posts } from "./posts";
/**
 * Exports a module member.
 */
export type { InsertPost, SelectPost } from "./posts";
/**
 * Re-exports module members.
 */
export { users } from "./users";
/**
 * Exports a module member.
 */
export type { InsertUser, SelectUser } from "./users";
