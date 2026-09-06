/**
 * The blog's edge cache vocabulary: the tags a public page is stored under and
 * the policy a handler declares. Both live here so a page and the CMS action
 * that invalidates it name the same tag, and so a lifetime changes in one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTags } from "@sdxc/workers-cache";

/**
 * Tags every cached public page carries. A post is tagged by the URL that serves
 * it rather than by its record id, because the id never appears in a public URL
 * and the CMS knows both. Every page listing posts shares one `postList` tag, so
 * a write invalidates the listings without having to know which ones exist.
 */
export const TAGS = createTags({
	post: (postType: string, postSlug: string) => `post:${postType}:${postSlug}`,
	postList: () => "posts",
});

/**
 * Lifetime for a public page. `max-age=0` keeps browsers revalidating, so a
 * reader never holds a copy the CMS can no longer reach, while `s-maxage` lets
 * the edge serve it until a write purges the tag.
 *
 * The shared lifetime is deliberately short: it is the ceiling on how long a bad
 * page can survive if purging is broken or turned off, and raising it is only
 * safe once the purge path has been watched working.
 */
export const PUBLIC_PAGE = "public, max-age=0, s-maxage=60, must-revalidate";
