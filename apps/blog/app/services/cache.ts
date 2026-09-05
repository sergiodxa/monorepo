/**
 * The blog's edge cache vocabulary: the tags a public page is stored under and
 * the policies a handler declares. Both live here so a page and the CMS action
 * that invalidates it name the same tag, and so a lifetime changes in one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTags } from "@sdxc/workers-cache";

/**
 * Tags every cached public page carries. A post is tagged by the URL that serves
 * it rather than by its record id, because the id never appears in a public URL
 * and the CMS knows both.
 */
export const TAGS = createTags({
	post: (postType: string, postSlug: string) => `post:${postType}:${postSlug}`,
});

/**
 * Lifetime for a published post page. `max-age=0` keeps browsers revalidating,
 * so a reader never holds a copy the CMS can no longer reach, while `s-maxage`
 * lets the edge serve it until a write purges the tag.
 */
export const PUBLIC_POST = "public, max-age=0, s-maxage=3600, must-revalidate";
