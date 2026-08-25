/**
 * Barrel module for the blog database schema. Re-exports the posts, post_meta,
 * and users tables, their relation definitions, and the select/insert row types,
 * giving repositories one import point for the whole schema surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { postMeta } from "./post-meta";
export type { InsertPostMeta, SelectPostMeta } from "./post-meta";
export { postMetaRelations, postRelations, userRelations } from "./relations";
export { posts } from "./posts";
export type { InsertPost, SelectPost } from "./posts";
export { users } from "./users";
export type { InsertUser, SelectUser } from "./users";
