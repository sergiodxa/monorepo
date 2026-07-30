/**
 * Post repository for blog and the core of its content model. Owns generic
 * post CRUD, publish-date semantics, timestamp normalization, joined post+meta
 * reads, and typed per-type mapping via codecs for articles, tutorials, etc.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { eq } from "remix/data-table";

import { PostMeta } from "~/app/repositories/post-meta";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import * as schema from "~/database/schema";

import { ArticlePost } from "./posts/article";

/**
 * Shared type contracts for post persistence and typed metadata mapping.
 *
 * The namespace only contains types so callers can compose typed wrappers
 * around generic post rows without introducing runtime dependencies.
 */
export namespace Post {
	/** Allowed discriminator values persisted in `posts.type`. */
	export type Type = schema.SelectPost["type"];

	/** Generic object constraint used by typed metadata helpers. */
	export type MetaObject = object;

	/**
	 * Bidirectional adapter between domain metadata objects and DB key/value rows.
	 *
	 * `serialize` is used before writes; `deserialize` is used after reads.
	 */
	export interface MetaCodec<meta extends object> {
		/** Converts partial domain metadata into rows accepted by `post_meta`. */
		serialize(meta: Partial<meta>): Array<{ key: string; value: string }>;
		/** Rebuilds full domain metadata from all rows belonging to one post. */
		deserialize(rows: Array<schema.SelectPostMeta>): meta;
	}

	/**
	 * Canonical create payload for raw post rows.
	 *
	 * Omitted timestamps default to repository-generated ISO values.
	 */
	export interface CreateInput {
		id?: string;
		author_id: string;
		type: Type;
		published_at?: string | null;
		meta?: Array<Omit<schema.InsertPostMeta, "post_id">>;
		created_at?: string;
		updated_at?: string;
	}

	/**
	 * Mutable fields for post updates.
	 *
	 * Metadata updates are keyed by `key`; existing keys are updated and missing
	 * keys are inserted.
	 */
	export interface UpdateInput {
		author_id?: string;
		type?: Type;
		published_at?: string | null;
		meta?: Array<{ key: string; value: string }>;
		updated_at?: string;
	}

	/** Typed create payload for one concrete post type. */
	export interface TypedCreateInput<meta extends object> {
		id?: string;
		author_id: string;
		published_at?: string | null;
		meta: meta;
		created_at?: string;
		updated_at?: string;
	}

	/** Typed update payload for one concrete post type. */
	export interface TypedUpdateInput<meta extends object> {
		author_id?: string;
		published_at?: string | null;
		meta?: Partial<meta>;
		updated_at?: string;
	}

	/** Post row narrowed to a concrete type with decoded metadata. */
	export type TypedResult<type extends Type, meta extends object> = Omit<
		schema.SelectPost,
		"type"
	> & {
		type: type;
		meta: meta;
	};

	/** Raw post row with all related metadata rows attached. */
	export interface FoundPost extends schema.SelectPost {
		meta: Array<schema.SelectPostMeta>;
	}

	/** Raw post row narrowed to a specific `type` discriminator. */
	export interface FoundPostForType<type extends Type> {
		post: Omit<schema.SelectPost, "type"> & { type: type };
	}

	/** Type-narrowed post row plus unresolved metadata rows. */
	export interface FoundPostWithMetaForType<type extends Type> extends FoundPostForType<type> {
		meta: Array<schema.SelectPostMeta>;
	}

	/** Public route segments supported by the post details page. */
	export type PublicTypePath = "articles" | "tutorials";

	/**
	 * Public controller payload returned when resolving a route type + slug.
	 *
	 * Article and tutorial shapes intentionally differ so controllers can render
	 * route-specific UI without extra narrowing logic.
	 */
	export type PublicFoundByTypeAndSlug =
		| {
				postType: "articles";
				post: {
					meta: {
						title: string;
						slug: string;
						excerpt?: string;
						canonical_url?: string;
						content: string;
					};
					published_at: string | null;
				};
		  }
		| {
				postType: "tutorials";
				post: {
					meta: {
						title: string;
						slug: string;
						excerpt?: string;
						content: string;
					};
					published_at: string | null;
				};
				tags: Array<string>;
		  };

	/** Tutorial related-post summary matched through one shared tag. */
	export interface RelatedByTypeItem {
		slug: string;
		title: string;
		matchedTag: string;
	}
}

/**
 * Data access and typed mapping helpers for posts and their metadata rows.
 *
 * This class owns generic CRUD primitives, while per-type repositories provide
 * codecs and type-specific behavior.
 */
export class Post {
	/** Table reference used by all post read/write operations. */
	static table = schema.posts;

	/**
	 * Returns whether a `published_at` value is currently considered public.
	 *
	 * Contract: `null` means immediately published.
	 *
	 * @param published_at Persisted publish timestamp (or `null` for immediate publish).
	 * @returns `true` when the post should be treated as published right now.
	 */
	static isPublishedAt(published_at: string | null) {
		if (published_at === null) return true;

		let timestamp = this.parseTimestamp(published_at);
		if (Number.isNaN(timestamp)) return false;

		return timestamp <= Date.now();
	}

	/**
	 * Resolves a sortable timestamp, preferring `published_at` over `created_at`.
	 *
	 * @param input Post timestamps in storage format.
	 * @returns Epoch milliseconds or `NaN` when neither value can be parsed.
	 */
	static timestampFromPublishedOrCreated(input: {
		published_at: string | null;
		created_at: string;
	}) {
		let value = input.published_at ?? input.created_at;
		return this.parseTimestamp(value);
	}

	/**
	 * Normalizes mixed timestamp inputs to epoch milliseconds.
	 *
	 * Accepts ISO-like strings, SQL datetime strings, second-based numbers/strings,
	 * and millisecond numbers/strings.
	 */
	private static parseTimestamp(value: unknown) {
		if (value === null || value === undefined) return Number.NaN;

		if (typeof value === "number") {
			if (!Number.isFinite(value)) return Number.NaN;
			if (value > 1_000_000_000_000) return value;
			return value * 1000;
		}

		let text = typeof value === "string" ? value : String(value);
		let parsed = Date.parse(text);
		if (Number.isFinite(parsed)) return parsed;

		let sqlDateTime = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)$/;
		let match = text.match(sqlDateTime);
		if (match) {
			let isoLike = `${match[1]}T${match[2]}Z`;
			let fallback = Date.parse(isoLike);
			if (Number.isFinite(fallback)) return fallback;
		}

		if (/^\d+$/.test(text)) {
			let numeric = Number(text);
			if (!Number.isFinite(numeric)) return Number.NaN;
			if (numeric > 1_000_000_000_000) return numeric;
			return numeric * 1000;
		}

		return Number.NaN;
	}

	/**
	 * Sort comparator that orders posts from newest to oldest.
	 *
	 * Uses `published_at` when present and falls back to `created_at`.
	 *
	 * @param a First post-like object to compare.
	 * @param b Second post-like object to compare.
	 * @returns Negative when `a` is newer than `b`, positive when older.
	 */
	static compareByPublishedOrCreatedDesc(
		a: { published_at: string | null; created_at: string },
		b: { published_at: string | null; created_at: string },
	) {
		return this.timestampFromPublishedOrCreated(b) - this.timestampFromPublishedOrCreated(a);
	}

	/**
	 * Resolves the public post payload for `/articles/:slug` or `/tutorials/:slug`.
	 *
	 * @param db Database handle used for lookups.
	 * @param input Route-like lookup input.
	 * @returns Public payload for the route type, or `null` when no post matches.
	 */
	static async findByTypeAndSlug(
		db: Database,
		input: { postType: Post.PublicTypePath; postSlug: string },
	): Promise<Post.PublicFoundByTypeAndSlug | null> {
		if (input.postType === "articles") {
			let post = await ArticlePost.findBySlug(db, input.postSlug);
			if (!post) return null;

			return {
				postType: "articles",
				post: {
					meta: {
						title: post.meta.title,
						slug: post.meta.slug,
						excerpt: post.meta.excerpt,
						canonical_url: post.meta.canonical_url,
						content: post.meta.content,
					},
					published_at: post.published_at,
				},
			};
		}

		let post = await TutorialPost.findBySlug(db, input.postSlug);
		if (!post) return null;

		return {
			postType: "tutorials",
			post: {
				meta: {
					title: post.meta.title,
					slug: post.meta.slug,
					excerpt: post.meta.excerpt,
					content: post.meta.content,
				},
				published_at: post.published_at,
			},
			tags: TutorialPost.tags(post.meta.tags),
		};
	}

	/**
	 * Finds related posts for a public route.
	 *
	 * Contract: only tutorials return related items; articles always return `[]`.
	 *
	 * @param db Database handle used for lookups.
	 * @param input Route-like lookup input and optional result limit.
	 * @returns Related tutorial items ordered by repository-specific relevance.
	 */
	static async findRelatedByTypeAndSlug(
		db: Database,
		input: { postType: Post.PublicTypePath; postSlug: string; limit?: number },
	): Promise<Array<Post.RelatedByTypeItem>> {
		if (input.postType !== "tutorials") return [];

		let post = await TutorialPost.findBySlug(db, input.postSlug);
		if (!post) return [];

		let tags = TutorialPost.tags(post.meta.tags);
		return TutorialPost.findRelatedByTags(db, post.id, tags, input.limit ?? 3);
	}

	/**
	 * Lists every post with attached metadata rows.
	 *
	 * @param db Database handle used for lookups.
	 * @returns Posts sorted by `created_at` descending.
	 */
	static async findAll(db: Database): Promise<Array<Post.FoundPost>> {
		let rows = await this.findJoinedRows(db);
		return this.groupJoinedRows(rows);
	}

	/**
	 * Finds one post by id with metadata rows attached.
	 *
	 * @param db Database handle used for lookups.
	 * @param id Post identifier.
	 * @returns Matching post with metadata, or `null` when not found.
	 */
	static async findById(db: Database, id: string): Promise<Post.FoundPost | null> {
		let posts = await this.findManyByIds(db, [id]);
		return posts[0] ?? null;
	}

	/**
	 * Creates a post row and optional metadata rows in one transaction.
	 *
	 * @param db Database handle used for writes.
	 * @param input Raw create payload.
	 * @returns Newly created post with metadata rows, or `null` when not retrievable.
	 */
	static async create(db: Database, input: Post.CreateInput) {
		let now = this.timestamp;
		let id = input.id ?? crypto.randomUUID();
		let meta = input.meta ?? [];

		await db.transaction(async (tx) => {
			await tx.create(this.table, {
				id,
				author_id: input.author_id,
				type: input.type,
				published_at: input.published_at ?? null,
				created_at: input.created_at ?? now,
				updated_at: input.updated_at ?? now,
			});

			await Promise.all(
				meta.map((item) =>
					PostMeta.create(tx, {
						id: item.id,
						post_id: id,
						key: item.key ?? "",
						value: item.value ?? "",
						created_at: item.created_at,
						updated_at: item.updated_at,
					}),
				),
			);
		});

		return this.findById(db, id);
	}

	/**
	 * Updates a post row and upserts metadata entries by key.
	 *
	 * Existing metadata keys are updated in place; unseen keys are inserted.
	 *
	 * @param db Database handle used for writes.
	 * @param id Post identifier.
	 * @param input Mutable field set and optional metadata updates.
	 * @returns Updated post with metadata, or `null` when the post does not exist.
	 */
	static async update(db: Database, id: string, input: Post.UpdateInput) {
		let existing = await db.findOne(this.table, { where: { id } });
		if (!existing) return null;
		let metaUpdates = input.meta ?? [];
		let existingMetaByKey = new Map<string, schema.SelectPostMeta>();

		if (metaUpdates.length > 0) {
			let existingMeta = await PostMeta.findByPostId(db, id);

			for (let item of existingMeta) {
				if (existingMetaByKey.has(item.key)) continue;
				existingMetaByKey.set(item.key, item);
			}
		}

		await db.transaction(async (tx) => {
			await tx.update(this.table, id, {
				author_id: input.author_id ?? existing.author_id,
				type: input.type ?? existing.type,
				published_at: input.published_at ?? existing.published_at,
				updated_at: input.updated_at ?? this.timestamp,
			});

			for (let item of metaUpdates) {
				let meta = existingMetaByKey.get(item.key);

				if (!meta) {
					await PostMeta.create(tx, {
						post_id: id,
						key: item.key,
						value: item.value,
					});
					continue;
				}

				await tx.update(PostMeta.table, meta.id, { value: item.value, updated_at: this.timestamp });
			}
		});

		return this.findById(db, id);
	}

	/**
	 * Deletes a post by id.
	 *
	 * @param db Database handle used for writes.
	 * @param id Post identifier.
	 * @returns Always `true` when the delete command is issued.
	 */
	static async destroy(db: Database, id: string) {
		await db.delete(this.table, id);
		return true;
	}

	/**
	 * Lists posts for one type and decodes metadata through a codec.
	 *
	 * @param db Database handle used for lookups.
	 * @param postType Concrete post type discriminator.
	 * @param codec Metadata adapter for that post type.
	 * @returns Type-narrowed posts with decoded metadata objects.
	 */
	static async findAllForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
		codec: Post.MetaCodec<meta>,
	) {
		let rows = await this.findJoinedRows(db, { type: postType });
		let posts = this.groupJoinedRows(rows);

		return posts.map((post) => this.toTypedResult<type, meta>(postType, post, codec));
	}

	/**
	 * Counts persisted rows for one post type.
	 *
	 * @param db Database handle used for counting.
	 * @param postType Concrete post type discriminator.
	 * @returns Number of posts for the requested type.
	 */
	static countForType<type extends Post.Type>(db: Database, postType: type) {
		return db.count(this.table, { where: { type: postType } });
	}

	/**
	 * Finds one typed post by id.
	 *
	 * @param db Database handle used for lookups.
	 * @param postType Concrete post type discriminator.
	 * @param id Post identifier.
	 * @param codec Metadata adapter for that post type.
	 * @returns Decoded typed post, or `null` when missing or type-mismatched.
	 */
	static async findByIdForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
		id: string,
		codec: Post.MetaCodec<meta>,
	) {
		let found = await this.findById(db, id);
		if (!found) return null;
		if (found.type !== postType) return null;

		return this.toTypedResult<type, meta>(postType, found, codec);
	}

	/**
	 * Finds one typed post by slug, resolving collisions deterministically.
	 *
	 * Slugs are searched through metadata rows, then the first row whose owning
	 * post matches `postType` is returned.
	 *
	 * @param db Database handle used for lookups.
	 * @param postType Concrete post type discriminator.
	 * @param slug Slug value stored in post metadata.
	 * @param codec Metadata adapter for that post type.
	 * @returns Decoded typed post, or `null` when none matches.
	 */
	static async findBySlugForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
		slug: string,
		codec: Post.MetaCodec<meta>,
	) {
		let matches = await PostMeta.findByKeyValue(db, "slug", slug);
		if (matches.length === 0) return null;

		let postIds = [...new Set(matches.map((match) => match.post_id))];
		let foundPosts = await this.findManyByIds(db, postIds);
		let foundById = new Map(foundPosts.map((post) => [post.id, post]));

		for (let match of matches) {
			let post = foundById.get(match.post_id);
			if (!post) continue;
			if (post.type !== postType) continue;

			return this.toTypedResult<type, meta>(postType, post, codec);
		}

		return null;
	}

	/**
	 * Fetches many posts by id and attaches metadata rows.
	 *
	 * Empty `ids` short-circuits to avoid unnecessary queries.
	 */
	private static async findManyByIds(
		db: Database,
		ids: Array<string>,
	): Promise<Array<Post.FoundPost>> {
		if (ids.length === 0) return [];

		let posts = await Promise.all(ids.map((id) => this.findOneJoinedById(db, id)));
		return posts.filter((post): post is Post.FoundPost => post !== null);
	}

	/**
	 * Loads post rows joined to metadata rows using adapter-safe predicates only.
	 *
	 * This avoids `data-table` relation and direct `IN` execution paths that currently
	 * fail under the app's adapter while still keeping feed/list reads batched.
	 */
	private static findJoinedRows(db: Database, where?: { type?: Post.Type }) {
		let query = db
			.query(this.table)
			.join(schema.postMeta, eq(schema.postMeta.post_id, this.table.id))
			.select({
				id: this.table.id,
				created_at: this.table.created_at,
				updated_at: this.table.updated_at,
				author_id: this.table.author_id,
				type: this.table.type,
				published_at: this.table.published_at,
				meta_id: schema.postMeta.id,
				meta_created_at: schema.postMeta.created_at,
				meta_updated_at: schema.postMeta.updated_at,
				meta_post_id: schema.postMeta.post_id,
				meta_key: schema.postMeta.key,
				meta_value: schema.postMeta.value,
			})
			.orderBy("posts.created_at", "desc");

		if (where?.type) return query.where({ type: where.type }).all();

		return query.all();
	}

	/**
	 * Loads one post and its metadata without the failing relation loader.
	 */
	private static async findOneJoinedById(db: Database, id: string): Promise<Post.FoundPost | null> {
		let post = await db.findOne(this.table, { where: { id } });
		if (!post) return null;

		let meta = await PostMeta.findByPostId(db, id);
		return { ...post, meta };
	}

	/**
	 * Reassembles `posts` joined with `post_meta` back into repository row shapes.
	 */
	private static groupJoinedRows(
		rows: Array<{
			id: string;
			created_at: string;
			updated_at: string;
			author_id: string;
			type: Post.Type;
			published_at: string | null;
			meta_id: string;
			meta_created_at: string;
			meta_updated_at: string;
			meta_post_id: string;
			meta_key: string;
			meta_value: string;
		}>,
	): Array<Post.FoundPost> {
		let posts = new Map<string, Post.FoundPost>();

		for (let row of rows) {
			let post = posts.get(row.id);

			if (!post) {
				post = {
					id: row.id,
					created_at: row.created_at,
					updated_at: row.updated_at,
					author_id: row.author_id,
					type: row.type,
					published_at: row.published_at,
					meta: [],
				};
				posts.set(row.id, post);
			}

			post.meta.push({
				id: row.meta_id,
				created_at: row.meta_created_at,
				updated_at: row.meta_updated_at,
				post_id: row.meta_post_id,
				key: row.meta_key,
				value: row.meta_value,
			});
		}

		return [...posts.values()];
	}

	/**
	 * Creates a typed post and returns its decoded metadata payload.
	 *
	 * @param db Database handle used for writes.
	 * @param postType Concrete post type discriminator.
	 * @param input Typed create payload.
	 * @param codec Metadata adapter for that post type.
	 * @returns Typed post with decoded metadata, or `null` when retrieval fails.
	 */
	static async createForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
		input: Post.TypedCreateInput<meta>,
		codec: Post.MetaCodec<meta>,
	): Promise<Post.TypedResult<type, meta> | null> {
		let created = await this.create(db, {
			id: input.id,
			author_id: input.author_id,
			type: postType,
			published_at: input.published_at,
			meta: codec.serialize(input.meta),
			created_at: input.created_at,
			updated_at: input.updated_at,
		});

		if (!created) return null;

		return this.toTypedResult<type, meta>(postType, created, codec);
	}

	/**
	 * Updates a typed post and returns decoded metadata.
	 *
	 * @param db Database handle used for writes.
	 * @param postType Concrete post type discriminator.
	 * @param id Post identifier.
	 * @param input Typed update payload.
	 * @param codec Metadata adapter for that post type.
	 * @returns Updated typed post with decoded metadata, or `null` when missing.
	 */
	static async updateForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
		id: string,
		input: Post.TypedUpdateInput<meta>,
		codec: Post.MetaCodec<meta>,
	): Promise<Post.TypedResult<type, meta> | null> {
		let existing = await db.findOne(this.table, { where: { id, type: postType } });
		if (!existing) return null;

		let metaRows = input.meta ? codec.serialize(input.meta) : undefined;
		let updated = await this.update(db, id, {
			author_id: input.author_id,
			type: postType,
			published_at: input.published_at,
			meta: metaRows,
			updated_at: input.updated_at,
		});

		if (!updated) return null;

		return this.toTypedResult<type, meta>(postType, updated, codec);
	}

	/**
	 * Converts a raw post + metadata rows into a typed repository result.
	 *
	 * This is the final narrowing step shared by all typed read/write helpers.
	 */
	private static toTypedResult<type extends Post.Type, meta extends object>(
		postType: type,
		post: Post.FoundPost,
		codec: Post.MetaCodec<meta>,
	): Post.TypedResult<type, meta> {
		let { meta: metaRows, ...postRow } = post;
		return { ...postRow, type: postType, meta: codec.deserialize(metaRows) };
	}

	/** Returns the current wall-clock time in ISO-8601 UTC format. */
	private static get timestamp() {
		return new Date().toISOString();
	}
}
