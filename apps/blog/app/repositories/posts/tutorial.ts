/**
 * Repository for tutorial posts, scoping the shared `Post` model to the `tutorial`
 * post type. It defines tutorial metadata types, a codec (including tag
 * parsing/serialization) to/from `post_meta` rows, CRUD/count/find-by-slug helpers, a
 * `listItems` projection, and related-tutorial lookup by shared tags. Query helpers
 * return published tutorials by default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { and, eq, inList } from "remix/data-table";

import { Post } from "~/app/repositories/post";
import { postMeta, posts } from "~/database/schema";

/**
 * Type contracts used by tutorial persistence and query helpers.
 *
 * The namespace stays type-only so repository runtime logic remains in `TutorialPost`.
 */
export namespace TutorialPost {
	/**
	 * Controls whether query helpers should keep future-dated preview posts.
	 */
	export interface QueryOptions {
		includePreview?: boolean;
	}

	/**
	 * Canonical metadata payload for tutorials.
	 *
	 * `tags` accepts either a single tag or an array so write paths can accept CMS forms
	 * and API payloads uniformly before normalization.
	 */
	export interface Meta {
		title: string;
		slug: string;
		excerpt: string;
		content: string;
		tags?: string | Array<string>;
	}

	/**
	 * Input contract for tutorial creation, including top-level post fields and `Meta`.
	 */
	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	/**
	 * Input contract for tutorial updates with partial typed metadata support.
	 */
	export interface UpdateInput extends Post.TypedUpdateInput<Meta> {}

	/**
	 * Lightweight tutorial projection used for index pages.
	 *
	 * `published_at` is preserved so callers can apply publish/preview semantics at render
	 * time (`null` means published in this app).
	 */
	export interface ListItem {
		id: string;
		title: string;
		slug: string;
		created_at: string;
		published_at: string | null;
	}

	/**
	 * Related tutorial candidate with the first tag match that triggered the relation.
	 */
	export interface RelatedItem {
		slug: string;
		title: string;
		matchedTag: string;
	}
}

/**
 * Ordered whitelist of tutorial metadata keys persisted in `post_meta`.
 *
 * The order is reused when serializing to keep metadata writes deterministic.
 */
let TUTORIAL_META_KEYS = ["title", "slug", "excerpt", "content", "tags"];

/**
 * Resolves the latest value for a metadata key from append-style rows.
 *
 * Rows are sorted by key and recency (`updated_at`, then `created_at`) so repeated
 * writes collapse to one logical value during decode.
 */
function tutorialMetaValue(
	rows: Array<{ key: string; value: string; created_at: string; updated_at: string }>,
	key: string,
) {
	let sortedRows = [...rows].sort((a, b) => {
		let keyCompare = String(a.key).localeCompare(String(b.key));
		if (keyCompare !== 0) return keyCompare;

		let updatedCompare = String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
		if (updatedCompare !== 0) return updatedCompare;

		return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
	});

	for (let row of sortedRows) {
		if (row.key === key) return row.value;
	}

	return undefined;
}

/**
 * Normalizes stored tag metadata into trimmed, unique tags.
 *
 * Accepts JSON arrays for current writes and gracefully falls back to a legacy/raw
 * string as a single tag.
 */
function parseTags(raw: string | undefined): Array<string> {
	if (!raw) return [];

	try {
		let parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		let tags: Array<string> = [];
		for (let value of parsed) {
			if (typeof value !== "string") continue;
			let normalized = value.trim();
			if (!normalized) continue;
			if (tags.includes(normalized)) continue;
			tags.push(normalized);
		}

		return tags;
	} catch {
		let normalized = raw.trim();
		if (!normalized) return [];
		return [normalized];
	}
}

/**
 * Canonicalizes tag input and serializes it for metadata storage.
 *
 * Empty or fully-invalid input returns `undefined` so no `tags` meta row is written.
 */
function serializeTags(input: TutorialPost.Meta["tags"]): string | undefined {
	if (typeof input === "undefined") return undefined;

	let source = Array.isArray(input) ? input : [input];
	let tags: Array<string> = [];

	for (let value of source) {
		if (typeof value !== "string") continue;
		let normalized = value.trim();
		if (!normalized) continue;
		if (tags.includes(normalized)) continue;
		tags.push(normalized);
	}

	if (tags.length === 0) return undefined;

	return JSON.stringify(tags);
}

/**
 * Bidirectional codec between typed tutorial metadata and `post_meta` rows.
 *
 * Decode intentionally supplies empty strings for required text fields so callers can
 * render safely even when historical metadata is incomplete.
 */
let tutorialMetaCodec: Post.MetaCodec<TutorialPost.Meta> = {
	serialize(meta) {
		let values = {
			title: meta.title,
			slug: meta.slug,
			excerpt: meta.excerpt,
			content: meta.content,
			tags: serializeTags(meta.tags),
		};

		let rows: Array<{ key: string; value: string }> = [];
		for (let key of TUTORIAL_META_KEYS) {
			let value = values[key as keyof typeof values];
			if (typeof value === "undefined") continue;
			rows.push({ key, value });
		}

		return rows;
	},
	deserialize(rows) {
		let tags = parseTags(tutorialMetaValue(rows, "tags"));
		return {
			title: tutorialMetaValue(rows, "title") ?? "",
			slug: tutorialMetaValue(rows, "slug") ?? "",
			excerpt: tutorialMetaValue(rows, "excerpt") ?? "",
			content: tutorialMetaValue(rows, "content") ?? "",
			tags: tags.length > 0 ? tags : undefined,
		};
	},
};

/**
 * Tutorial repository facade over shared `Post` primitives.
 *
 * It centralizes tutorial-specific metadata shaping and helper queries so controllers
 * can stay focused on HTTP concerns.
 */
export class TutorialPost {
	/**
	 * Post type discriminator used by all tutorial persistence operations.
	 */
	static postType = "tutorial" as const;

	/**
	 * Returns tutorial records with decoded metadata, optionally including previews.
	 *
	 * Public callers get published tutorials only unless `includePreview` is enabled.
	 * @param db Database connection used for querying.
	 * @param options Query options controlling preview visibility.
	 */
	static async findAll(db: Database, options?: TutorialPost.QueryOptions) {
		let tutorials = await Post.findAllForType<"tutorial", TutorialPost.Meta>(
			db,
			this.postType,
			tutorialMetaCodec,
		);

		if (options?.includePreview) return tutorials;

		return tutorials.filter((tutorial) => Post.isPublishedAt(tutorial.published_at));
	}

	/**
	 * Counts all tutorial rows regardless of publish timing.
	 */
	static count(db: Database) {
		return Post.countForType(db, this.postType);
	}

	/**
	 * Finds a tutorial by primary id with typed metadata decode.
	 */
	static findById(db: Database, id: string) {
		return Post.findByIdForType<"tutorial", TutorialPost.Meta>(
			db,
			this.postType,
			id,
			tutorialMetaCodec,
		);
	}

	/**
	 * Finds a tutorial by slug within tutorial-type posts.
	 */
	static findBySlug(db: Database, slug: string) {
		return Post.findBySlugForType<"tutorial", TutorialPost.Meta>(
			db,
			this.postType,
			slug,
			tutorialMetaCodec,
		);
	}

	/**
	 * Creates a tutorial post and persists normalized metadata rows.
	 */
	static create(db: Database, input: TutorialPost.CreateInput) {
		return Post.createForType<"tutorial", TutorialPost.Meta>(
			db,
			this.postType,
			input,
			tutorialMetaCodec,
		);
	}

	/**
	 * Updates post fields and tutorial metadata using the same codec as creation.
	 */
	static update(db: Database, id: string, input: TutorialPost.UpdateInput) {
		return Post.updateForType<"tutorial", TutorialPost.Meta>(
			db,
			this.postType,
			id,
			input,
			tutorialMetaCodec,
		);
	}

	/**
	 * Deletes a tutorial post by id along with its metadata rows.
	 */
	static destroy(db: Database, id: string) {
		return Post.destroy(db, id);
	}

	/**
	 * Produces a string-array view of metadata tags for matching helpers.
	 *
	 * Values pass through verbatim because the input is already-decoded metadata.
	 */
	static tags(metaTags: string | string[] | undefined): Array<string> {
		if (Array.isArray(metaTags)) {
			return metaTags.filter((tag): tag is string => typeof tag === "string");
		}

		if (typeof metaTags === "string") return [metaTags];

		return [];
	}

	/**
	 * Finds related tutorials by first shared tag match.
	 *
	 * Results preserve repository ordering from `findAll`, skip the current post id, and
	 * stop once `limit` matches are collected.
	 */
	static async findRelatedByTags(
		db: Database,
		currentPostId: string,
		tags: Array<string>,
		limit = 3,
	): Promise<Array<TutorialPost.RelatedItem>> {
		if (tags.length === 0) return [];

		let tutorials = await this.findAll(db);
		let related: Array<TutorialPost.RelatedItem> = [];

		for (let tutorial of tutorials) {
			if (tutorial.id === currentPostId) continue;

			let tutorialTags = this.tags(tutorial.meta.tags);
			let match = tutorialTags.find((tag) => tags.includes(tag));
			if (!match) continue;

			related.push({
				slug: tutorial.meta.slug,
				title: tutorial.meta.title,
				matchedTag: match,
			});

			if (related.length >= limit) break;
		}

		return related;
	}

	/**
	 * Builds list projections with title/slug metadata hydrated per post id.
	 *
	 * Missing metadata falls back to deterministic placeholders, then items are sorted by
	 * effective publish date (`published_at` when present, otherwise `created_at`).
	 * @param db Database connection used for querying.
	 * @param options Query options controlling preview visibility.
	 * @returns List items for public or CMS tutorial listings, depending on `includePreview`.
	 */
	static async listItems(
		db: Database,
		options?: TutorialPost.QueryOptions,
	): Promise<Array<TutorialPost.ListItem>> {
		let rows = await db
			.query(posts)
			.join(postMeta, and(eq(postMeta.post_id, posts.id), inList(postMeta.key, ["title", "slug"])))
			.where({ type: this.postType })
			.select({
				id: posts.id,
				created_at: posts.created_at,
				published_at: posts.published_at,
				meta_key: postMeta.key,
				meta_value: postMeta.value,
			})
			.orderBy("posts.created_at", "desc")
			.all();

		let byId = new Map<string, TutorialPost.ListItem>();

		for (let row of rows) {
			let item = byId.get(row.id);

			if (!item) {
				item = {
					id: row.id,
					title: `Tutorial ${row.id}`,
					slug: row.id,
					created_at: row.created_at,
					published_at: row.published_at,
				};
				byId.set(row.id, item);
			}

			if (row.meta_key === "title" && row.meta_value.trim()) item.title = row.meta_value;
			if (row.meta_key === "slug" && row.meta_value.trim()) item.slug = row.meta_value;
		}

		let items = [...byId.values()].sort((a, b) => {
			return Post.compareByPublishedOrCreatedDesc(a, b);
		});

		if (options?.includePreview) return items;

		return items.filter((tutorial) => Post.isPublishedAt(tutorial.published_at));
	}
}
