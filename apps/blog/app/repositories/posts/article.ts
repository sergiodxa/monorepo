/**
 * Repository for article posts, scoping the shared `Post` model to the `article`
 * post type. It defines article metadata types, a codec mapping typed metadata to
 * and from `post_meta` rows, and CRUD/count/find-by-slug helpers plus a
 * `listItems` projection that joins title/slug meta and sorts by publish date.
 * Filters out unpublished previews by default. Exists for type-safe article data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { and, eq, inList } from "remix/data-table";

import { Post } from "~/app/repositories/post";
import { postMeta, posts } from "~/database/schema";

/**
 * Article-specific contracts used by the article repository.
 *
 * This namespace is type-only and mirrors the metadata persisted in `post_meta`.
 */
export namespace ArticlePost {
	/**
	 * Controls whether query helpers should keep future-dated preview posts.
	 */
	export interface QueryOptions {
		includePreview?: boolean;
	}

	/**
	 * Metadata fields persisted for article posts.
	 *
	 * `slug`, `title`, `locale`, and `content` are always materialized by the codec,
	 * while optional fields may be omitted when not provided.
	 */
	export interface Meta {
		slug: string;
		title: string;
		locale: string;
		content: string;
		excerpt?: string;
		canonical_url?: string;
	}

	/**
	 * Input accepted when creating an article post.
	 *
	 * Combines base post fields with typed article metadata.
	 */
	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	/**
	 * Input accepted when updating an article post.
	 *
	 * Supports partial metadata updates while preserving article metadata typing.
	 */
	export interface UpdateInput extends Post.TypedUpdateInput<Meta> {}

	/**
	 * Lightweight article shape returned by list queries.
	 *
	 * Uses DB timestamps and metadata-derived `title`/`slug` values with fallbacks.
	 */
	export interface ListItem {
		id: string;
		title: string;
		slug: string;
		created_at: string;
		published_at: string | null;
	}
}

/**
 * Ordered metadata keys persisted for article posts.
 *
 * This order is used by serialization so metadata writes stay predictable across updates.
 */
let ARTICLE_META_KEYS = ["slug", "title", "locale", "content", "excerpt", "canonical_url"];

/**
 * Returns the most recent value for a metadata key.
 *
 * Rows are sorted by key and recency (`updated_at`, then `created_at`) so duplicate
 * key entries resolve to the latest value.
 * @param rows Candidate metadata rows for one post.
 * @param key Metadata key to resolve.
 * @returns The latest value for `key`, or `undefined` when absent.
 */
function articleMetaValue(
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
 * Codec for translating typed article metadata to and from `post_meta` rows.
 *
 * Serialization omits undefined optional fields; deserialization applies defaults for
 * required fields so consumers always receive a complete `ArticlePost.Meta` object.
 */
let articleMetaCodec: Post.MetaCodec<ArticlePost.Meta> = {
	/**
	 * Converts typed article metadata into storable key/value rows.
	 * @param meta Metadata payload for an article post.
	 * @returns Ordered key/value rows ready to persist in `post_meta`.
	 */
	serialize(meta) {
		let values = {
			slug: meta.slug,
			title: meta.title,
			locale: meta.locale,
			content: meta.content,
			excerpt: meta.excerpt,
			canonical_url: meta.canonical_url,
		};

		let rows: Array<{ key: string; value: string }> = [];
		for (let key of ARTICLE_META_KEYS) {
			let value = values[key as keyof typeof values];
			if (typeof value === "undefined") continue;
			rows.push({ key, value });
		}

		return rows;
	},
	/**
	 * Reconstructs typed article metadata from metadata rows.
	 * @param rows Metadata rows loaded from `post_meta`.
	 * @returns A normalized metadata object with safe defaults for required fields.
	 */
	deserialize(rows) {
		return {
			slug: articleMetaValue(rows, "slug") ?? "",
			title: articleMetaValue(rows, "title") ?? "",
			locale: articleMetaValue(rows, "locale") ?? "en",
			content: articleMetaValue(rows, "content") ?? "",
			excerpt: articleMetaValue(rows, "excerpt"),
			canonical_url: articleMetaValue(rows, "canonical_url"),
		};
	},
};

/**
 * Repository for querying and mutating posts with the `article` type.
 *
 * Delegates shared CRUD behavior to `Post` helpers and provides article-specific list shaping.
 */
export class ArticlePost {
	/**
	 * Post type discriminator used by shared post helpers.
	 *
	 * This value must stay aligned with persisted `posts.type` records.
	 */
	static postType = "article" as const;

	/**
	 * Lists article posts with decoded metadata, optionally including previews.
	 * @param db Database connection used for querying.
	 * @param options Query options controlling preview visibility.
	 * @returns All article posts with typed metadata.
	 */
	static async findAll(db: Database, options?: ArticlePost.QueryOptions) {
		let articles = await Post.findAllForType<"article", ArticlePost.Meta>(
			db,
			this.postType,
			articleMetaCodec,
		);

		if (options?.includePreview) return articles;

		return articles.filter((article) => Post.isPublishedAt(article.published_at));
	}

	/**
	 * Counts all posts stored as articles.
	 * @param db Database connection used for querying.
	 * @returns Total number of article posts.
	 */
	static count(db: Database) {
		return Post.countForType(db, this.postType);
	}

	/**
	 * Finds an article post by its identifier.
	 * @param db Database connection used for querying.
	 * @param id Post identifier.
	 * @returns The matching article post, or `null` when not found.
	 */
	static findById(db: Database, id: string) {
		return Post.findByIdForType<"article", ArticlePost.Meta>(
			db,
			this.postType,
			id,
			articleMetaCodec,
		);
	}

	/**
	 * Finds an article post by its slug metadata.
	 * @param db Database connection used for querying.
	 * @param slug Article slug stored in metadata.
	 * @returns The matching article post, or `null` when not found.
	 */
	static findBySlug(db: Database, slug: string) {
		return Post.findBySlugForType<"article", ArticlePost.Meta>(
			db,
			this.postType,
			slug,
			articleMetaCodec,
		);
	}

	/**
	 * Creates a new article post and persists its metadata.
	 * @param db Database connection used for mutation.
	 * @param input Post and metadata values to persist.
	 * @returns The newly created article post.
	 */
	static create(db: Database, input: ArticlePost.CreateInput) {
		return Post.createForType<"article", ArticlePost.Meta>(
			db,
			this.postType,
			input,
			articleMetaCodec,
		);
	}

	/**
	 * Updates an article post and its metadata values.
	 * @param db Database connection used for mutation.
	 * @param id Post identifier to update.
	 * @param input Partial post and metadata updates.
	 * @returns The updated article post, or `null` when the post is missing.
	 */
	static update(db: Database, id: string, input: ArticlePost.UpdateInput) {
		return Post.updateForType<"article", ArticlePost.Meta>(
			db,
			this.postType,
			id,
			input,
			articleMetaCodec,
		);
	}

	/**
	 * Deletes an article post by identifier.
	 * @param db Database connection used for mutation.
	 * @param id Post identifier to delete.
	 * @returns Result from the shared destroy operation.
	 */
	static destroy(db: Database, id: string) {
		return Post.destroy(db, id);
	}

	/**
	 * Returns article list items with metadata-driven title and slug values.
	 *
	 * Items default to `Article {id}` and `id` when metadata is missing or blank, then
	 * are sorted descending by published date, falling back to created date.
	 * @param db Database connection used for querying.
	 * @param options Query options controlling preview visibility.
	 * @returns List items suitable for admin-style article listings.
	 */
	static async listItems(
		db: Database,
		options?: ArticlePost.QueryOptions,
	): Promise<Array<ArticlePost.ListItem>> {
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
			.all();

		let byId = new Map<string, ArticlePost.ListItem>();

		for (let row of rows) {
			let item = byId.get(row.id);

			if (!item) {
				item = {
					id: row.id,
					title: `Article ${row.id}`,
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

		return items.filter((article) => Post.isPublishedAt(article.published_at));
	}
}
