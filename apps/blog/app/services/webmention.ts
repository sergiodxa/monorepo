/**
 * What the blog's Webmention traffic identifies itself as, and the permalink a post
 * sends from. Every source it verifies and every endpoint it notifies sees this name,
 * so a publisher can tell who is asking and reach the site behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Post } from "~/app/repositories/post";

import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/** Sent on every source fetch, discovery and send; names the site it acts for. */
export const USER_AGENT = `sergiodxa.com Webmention (+${PROFILE.canonical.origin})`;

/**
 * The canonical permalink a post sends its Webmentions from. Built on the site's own
 * origin rather than a request's, since sending runs in a job that has none.
 *
 * @param post The post's collection path and slug.
 */
export function permalink(post: { postType: Post.PublicTypePath; slug: string }): URL {
	return new URL(
		routes.post.href({ postType: post.postType, postSlug: post.slug }),
		PROFILE.canonical.origin,
	);
}
