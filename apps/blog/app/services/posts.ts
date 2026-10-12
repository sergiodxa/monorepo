/**
 * Reads that span post types: the public payload of a post page, the tombstone a deleted
 * permalink answers with, what sending a post's Webmentions needs, and which post a
 * Webmention target names. Each reads through the type's own model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BlogModels } from "~/app/models";
import type { PublicTypePath } from "~/app/models/kinds";
import type { PostType } from "~/app/models/post-values";
import type { RelatedTutorial } from "~/app/models/tutorials";

import { isPublicTypePath, publicTypePathOf } from "~/app/models/kinds";
import { isPublishedAt, tutorialTags } from "~/app/models/post-values";

/** A post permalink, `/<topic>/:slug` without an extension; the topic must have post pages. */
const MENTIONABLE_PATH = /^\/([^/.]+)\/([^/.]+)$/;

/** A public post page's route-like address. */
export interface PublicPostAddress {
	postType: PublicTypePath;
	postSlug: string;
}

/**
 * What a public post page renders. Each kind's shape differs so controllers render
 * route-specific UI straight from the payload; a note has no title, only content.
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
	  }
	| {
			postType: "notes";
			post: {
				id: string;
				meta: { slug: string; content: string };
				published_at: string | null;
				created_at: string;
				/** When the post or its content last changed, which an EPUB reports as its `modified`. */
				updated_at: string;
			};
	  }
	| {
			postType: "til";
			post: {
				id: string;
				meta: { title: string; slug: string; content: string };
				published_at: string | null;
				created_at: string;
				/** When the post or its content last changed, which an EPUB reports as its `modified`. */
				updated_at: string;
			};
			tags: string[];
	  }
	| {
			postType: "releases";
			post: {
				id: string;
				meta: { title: string; slug: string; content: string };
				published_at: string | null;
				created_at: string;
				/** When the post or its content last changed, which an EPUB reports as its `modified`. */
				updated_at: string;
			};
			/** The package names the share text lists, as the weekly job found them. */
			packages: string[];
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
 * Resolves the public post payload for a post page, read through its kind's own model.
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

	if (address.postType === "notes") {
		let note = await models.notes.findBySlug(address.postSlug);
		if (!note) return null;

		return {
			postType: "notes",
			post: {
				id: note.id,
				meta: { slug: note.meta.slug, content: note.meta.content },
				published_at: note.published_at,
				created_at: note.created_at,
				updated_at: note.updated_at,
			},
		};
	}

	if (address.postType === "til") {
		let til = await models.tils.findBySlug(address.postSlug);
		if (!til) return null;

		return {
			postType: "til",
			post: {
				id: til.id,
				meta: { title: til.meta.title, slug: til.meta.slug, content: til.meta.content },
				published_at: til.published_at,
				created_at: til.created_at,
				updated_at: til.updated_at,
			},
			tags: tutorialTags(til.meta.tags),
		};
	}

	if (address.postType === "releases") {
		let release = await models.releases.findBySlug(address.postSlug);
		if (!release) return null;

		return {
			postType: "releases",
			post: {
				id: release.id,
				meta: {
					title: release.meta.title,
					slug: release.meta.slug,
					content: release.meta.content,
				},
				published_at: release.published_at,
				created_at: release.created_at,
				updated_at: release.updated_at,
			},
			packages: release.meta.packages.map((pkg) => pkg.name),
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
	let post = await tombstoneAt(models, address);
	return post?.deleted_at ? { deleted_at: post.deleted_at } : null;
}

/** The deleted post under a permalink, read through its kind's model. */
function tombstoneAt(models: BlogModels, address: PublicPostAddress) {
	if (address.postType === "articles") return models.articles.findTombstone(address.postSlug);
	if (address.postType === "notes") return models.notes.findTombstone(address.postSlug);
	if (address.postType === "til") return models.tils.findTombstone(address.postSlug);
	if (address.postType === "releases") return models.releases.findTombstone(address.postSlug);
	return models.tutorials.findTombstone(address.postSlug);
}

/** Whether a public URL belonged to a post that was deleted. */
export async function isTombstoned(models: BlogModels, address: PublicPostAddress) {
	return (await findTombstone(models, address)) !== null;
}

/**
 * Reads what sending a post's Webmentions needs, deleted posts included, since a delete
 * notifies every target the post had linked.
 *
 * @returns The post with its Markdown source, or `null` for a kind without post pages.
 */
export async function findForMentions(
	models: BlogModels,
	id: string,
): Promise<MentionSource | null> {
	let row = await models.posts.unscoped().where({ id }).first();
	let postType = row ? publicTypePathOf(row.type) : null;
	if (!row || postType === null) return null;

	let meta = await permalinkedMeta(models, id, row.type);
	if (!meta) return null;

	return {
		id: row.id,
		postType,
		slug: meta.slug || row.id,
		content: meta.content,
		published_at: row.published_at,
		deleted_at: row.deleted_at,
		federated_at: row.federated_at,
	};
}

/**
 * The slug and Markdown of a post of a kind with a post page, deleted or not, read through
 * its kind's model; `null` for any other type.
 */
async function permalinkedMeta(
	models: BlogModels,
	id: string,
	type: PostType,
): Promise<{ slug: string; content: string } | null> {
	if (type === "article")
		return (await models.articles.unscoped().where({ id }).first())?.meta ?? null;
	if (type === "tutorial")
		return (await models.tutorials.unscoped().where({ id }).first())?.meta ?? null;
	if (type === "note") return (await models.notes.unscoped().where({ id }).first())?.meta ?? null;
	if (type === "til") return (await models.tils.unscoped().where({ id }).first())?.meta ?? null;
	if (type === "release")
		return (await models.releases.unscoped().where({ id }).first())?.meta ?? null;
	return null;
}

/**
 * Resolves a URL on this site to the published post whose page it is, which is what the
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
	if (!isPublicTypePath(postType)) return null;
	if (postSlug === undefined) return null;

	let found = await findPublicPost(models, { postType, postSlug: decodeURIComponent(postSlug) });
	if (!found || !isPublishedAt(found.post.published_at)) return null;

	return { id: found.post.id, postType, postSlug: found.post.meta.slug };
}
