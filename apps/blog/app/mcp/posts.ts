/**
 * What the post tools and resources share: the publish rule a read enforces, since the
 * models return preview posts too, and the list row a machine reader gets, carrying the
 * URL so a citation is possible.
 *
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BlogModels } from "~/app/models";
import type { PublicTypePath } from "~/app/models/kinds";
import type { PublicPost } from "~/app/services/posts";

import { isPublishedAt, timestampFromPublishedOrCreated } from "~/app/models/post-values";
import { findPublicPost } from "~/app/services/posts";

/** Where each collection's pages live, for building a post's public URL. */
export const COLLECTION_PATHS = { articles: "/articles", tutorials: "/tutorials" } as const;

/**
 * Reads one published post, or reports it as absent.
 *
 * The publish rule is enforced here because `findByTypeAndSlug` returns preview posts too;
 * only the HTML route otherwise guards against a slug learned elsewhere reaching a draft.
 *
 * @param models The request's models.
 * @param postType Which collection to look in.
 * @param postSlug The post's slug.
 * @returns The post, or `null` when it is missing or still in preview.
 */
export async function findPublished(
	models: BlogModels,
	postType: PublicTypePath,
	postSlug: string,
): Promise<PublicPost | null> {
	let found = await findPublicPost(models, { postType, postSlug });
	if (!found) return null;
	if (!isPublishedAt(found.post.published_at)) return null;
	return found;
}

/** Projects a list row for a machine reader, carrying the URL so a citation is possible. */
export function listItem(
	collection: keyof typeof COLLECTION_PATHS,
	item: { title: string; slug: string; published_at: string | null; created_at: string },
) {
	let timestamp = timestampFromPublishedOrCreated(item);

	return {
		title: item.title,
		slug: item.slug,
		url: `${COLLECTION_PATHS[collection]}/${item.slug}`,
		publishedAt: Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString(),
	};
}
