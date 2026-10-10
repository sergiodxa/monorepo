/**
 * Reads that span post types: the public payload of `/articles/:slug` and `/tutorials/:slug`,
 * the tombstone a deleted permalink answers with, what sending a post's Webmentions needs, and
 * which post a Webmention target names. Each reads through the type's own model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BlogModels } from "~/app/models";
import type { PublicTypePath } from "~/app/models/post-values";
import type { RelatedTutorial } from "~/app/models/tutorials";

import { isPublishedAt, tutorialTags } from "~/app/models/post-values";

/** A post permalink: `/articles/:slug` or `/tutorials/:slug`, without an extension. */
const MENTIONABLE_PATH = /^\/(articles|tutorials)\/([^/.]+)$/;

/** A public post page's route-like address. */
export interface PublicPostAddress {
	postType: PublicTypePath;
	postSlug: string;
}

/**
 * What a public post page renders. Article and tutorial shapes differ so controllers render
 * route-specific UI straight from the payload.
 */
export type PublicPost =
	| {
			postType: "articles";
			post: {
				id: string;
				meta: {
					title: string;
					slug: string;
					excerpt?: string;
					canonical_url?: string;
					content: string;
				};
				published_at: string | null;
				created_at: string;
				/** When the post or its content last changed, which an EPUB reports as its `modified`. */
				updated_at: string;
			};
	  }
	| {
			postType: "tutorials";
			post: {
				id: string;
				meta: { title: string; slug: string; excerpt?: string; content: string };
				published_at: string | null;
				created_at: string;
				/** When the post or its content last changed, which an EPUB reports as its `modified`. */
				updated_at: string;
			};
			tags: string[];
	  };

/** What sending a post's Webmentions reads: its permalink parts, source and state. */
export interface MentionSource {
	id: string;
	postType: PublicTypePath;
	slug: string;
	/** The Markdown source, whose rendered links are the targets. */
	content: string;
	published_at: string | null;
	deleted_at: string | null;
	/** When followers were sent its `Create`; `null` while they never were. */
	federated_at: string | null;
}

/**
 * Resolves the public post payload for `/articles/:slug` or `/tutorials/:slug`.
 *
 * @returns The payload for the route's type, or `null` when no live post has the slug.
 */
export async function findPublicPost(
	models: BlogModels,
	address: PublicPostAddress,
): Promise<PublicPost | null> {
	if (address.postType === "articles") {
		let post = await models.articles.findBySlug(address.postSlug);
		if (!post) return null;

		return {
			postType: "articles",
			post: {
				id: post.id,
				meta: {
					title: post.meta.title,
					slug: post.meta.slug,
					excerpt: post.meta.excerpt,
					canonical_url: post.meta.canonical_url,
					content: post.meta.content,
				},
				published_at: post.published_at,
				created_at: post.created_at,
				updated_at: post.updated_at,
			},
		};
	}

	let post = await models.tutorials.findBySlug(address.postSlug);
	if (!post) return null;

	return {
		postType: "tutorials",
		post: {
			id: post.id,
			meta: {
				title: post.meta.title,
				slug: post.meta.slug,
				excerpt: post.meta.excerpt,
				content: post.meta.content,
			},
			published_at: post.published_at,
			created_at: post.created_at,
			updated_at: post.updated_at,
		},
		tags: tutorialTags(post.meta.tags),
	};
}

/**
 * The tutorials suggested beside a public post: only a tutorial has any, matched by a shared
 * tag; an article answers none.
 */
export async function findRelatedPosts(
	models: BlogModels,
	address: PublicPostAddress & { limit?: number },
): Promise<RelatedTutorial[]> {
	if (address.postType !== "tutorials") return [];

	let post = await models.tutorials.findBySlug(address.postSlug);
	if (!post) return [];

	return models.tutorials.findRelatedByTags(
		post.id,
		tutorialTags(post.meta.tags),
		address.limit ?? 3,
	);
}

/**
 * The deleted post a public URL belonged to, which the page answers 410 Gone for; a live post
 * reusing the slug takes precedence upstream.
 */
export async function findTombstone(
	models: BlogModels,
	address: PublicPostAddress,
): Promise<{ deleted_at: string } | null> {
	let post =
		address.postType === "articles"
			? await models.articles.findTombstone(address.postSlug)
			: await models.tutorials.findTombstone(address.postSlug);
	return post?.deleted_at ? { deleted_at: post.deleted_at } : null;
}

/** Whether a public URL belonged to a post that was deleted. */
export async function isTombstoned(models: BlogModels, address: PublicPostAddress) {
	return (await findTombstone(models, address)) !== null;
}

/**
 * Reads what sending a post's Webmentions needs, deleted posts included, since a delete
 * notifies every target the post had linked.
 *
 * @returns The article or tutorial with its Markdown source, or `null` for any other post.
 */
export async function findForMentions(
	models: BlogModels,
	id: string,
): Promise<MentionSource | null> {
	let post =
		(await models.articles.unscoped().where({ id }).first()) ??
		(await models.tutorials.unscoped().where({ id }).first());
	if (!post) return null;

	return {
		id: post.id,
		postType: post.type === "article" ? "articles" : "tutorials",
		slug: post.meta.slug || post.id,
		content: post.meta.content,
		published_at: post.published_at,
		deleted_at: post.deleted_at,
		federated_at: post.federated_at,
	};
}

/**
 * Resolves a URL on this site to the published article or tutorial it names, which is what the
 * Webmention endpoint accepts mentions for. Another origin, another path, an extension, a
 * preview or a deleted post all resolve to `null`.
 */
export async function findMentionable(
	models: BlogModels,
	target: URL,
	origin: string,
): Promise<{ id: string; postType: PublicTypePath; postSlug: string } | null> {
	if (target.origin !== origin) return null;

	let match = MENTIONABLE_PATH.exec(target.pathname);
	let postType = match?.[1];
	let postSlug = match?.[2];
	if (postType !== "articles" && postType !== "tutorials") return null;
	if (postSlug === undefined) return null;

	let found = await findPublicPost(models, { postType, postSlug: decodeURIComponent(postSlug) });
	if (!found || !isPublishedAt(found.post.published_at)) return null;

	return { id: found.post.id, postType, postSlug: found.post.meta.slug };
}
