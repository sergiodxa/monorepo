/**
 * Barrel module for the blog database schema. Re-exports the posts, post_meta, post_search,
 * bookmarks, users, Webmention and ActivityPub follower tables, their relations, and the
 * select/insert row types, giving repositories one import point for the whole schema surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { activityPubFollowers } from "./activitypub-followers";
export type { SelectActivityPubFollower } from "./activitypub-followers";
export { bookmarks } from "./bookmarks";
export type { SelectBookmark } from "./bookmarks";
export { postMeta } from "./post-meta";
export type { InsertPostMeta, SelectPostMeta } from "./post-meta";
export { postSearch } from "./post-search";
export type { SelectPostSearch } from "./post-search";
export { postMetaRelations, postRelations, userRelations } from "./relations";
export { posts } from "./posts";
export type { InsertPost, SelectPost } from "./posts";
export { users } from "./users";
export type { InsertUser, SelectUser } from "./users";
export { webmentionDomains, webmentionSends, webmentions } from "./webmentions";
export type { SelectWebmention, SelectWebmentionDomain, SelectWebmentionSend } from "./webmentions";
