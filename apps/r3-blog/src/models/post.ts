import type { Database } from "remix/data-table";

import { PostMeta } from "~/models/post-meta";
import * as schema from "~/schema";

export namespace Post {
	/**
	 * Shared types and DTOs used by the Post model.
	 */
	/**
	 * Post type discriminator stored on each post row.
	 * @example
	 * let postType: Post.Type = "article";
	 */
	export type Type = schema.SelectPost["type"];

	/**
	 * Generic metadata object shape used by typed helpers.
	 * @example
	 * let meta: Post.MetaObject = { slug: "hello-world", tags: ["intro"] };
	 */
	export type MetaObject = object;

	/**
	 * Input payload used to create a post and optional metadata rows.
	 * @example
	 * let input: Post.CreateInput = {
	 * 	authorId: "author_123",
	 * 	type: "article",
	 * 	meta: [{ key: "slug", value: "hello-world" }],
	 * };
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
	 * Input payload used to update a post and metadata values.
	 * @example
	 * let input: Post.UpdateInput = {
	 * 	publishedAt: new Date().toISOString(),
	 * 	meta: [{ key: "slug", value: "updated-slug" }],
	 * };
	 */
	export interface UpdateInput {
		author_id?: string;
		type?: Type;
		published_at?: string | null;
		meta?: Array<{ key: string; value: string }>;
		updated_at?: string;
	}

	/**
	 * Type-safe input payload for creating a post of a specific type.
	 * @example
	 * interface ArticleMeta { slug: string; summary: string; }
	 * let input: Post.TypedCreateInput<ArticleMeta> = {
	 * 	authorId: "author_123",
	 * 	meta: { slug: "hello-world", summary: "Intro post" },
	 * };
	 */
	export interface TypedCreateInput<meta extends object> {
		id?: string;
		author_id: string;
		published_at?: string | null;
		meta: meta;
		created_at?: string;
		updated_at?: string;
	}

	/**
	 * Type-safe input payload for updating a typed post.
	 * @example
	 * interface ArticleMeta { slug: string; summary: string; }
	 * let input: Post.TypedUpdateInput<ArticleMeta> = {
	 * 	meta: { summary: "Updated summary" },
	 * };
	 */
	export interface TypedUpdateInput<meta extends object> {
		author_id?: string;
		published_at?: string | null;
		meta?: Partial<meta>;
		updated_at?: string;
	}

	/**
	 * Typed post result including post row data and parsed metadata object.
	 * @example
	 * interface ArticleMeta { slug: string; }
	 * let result: Post.TypedResult<"article", ArticleMeta> = {
	 * 	post: { id: "1", authorId: "a1", type: "article", publishedAt: null, createdAt: "", updatedAt: "" },
	 * 	meta: { slug: "hello-world" },
	 * };
	 */
	export interface TypedResult<type extends Type, meta extends object> {
		post: Omit<schema.SelectPost, "type"> & { type: type };
		meta: meta;
	}

	/**
	 * Full post lookup result with all metadata rows.
	 * @example
	 * let found: Post.FoundPost = {
	 * 	post: { id: "1", authorId: "a1", type: "article", publishedAt: null, createdAt: "", updatedAt: "" },
	 * 	meta: [{ id: "m1", postId: "1", key: "slug", value: "hello-world", createdAt: "", updatedAt: "" }],
	 * };
	 */
	export interface FoundPost {
		post: schema.SelectPost;
		meta: Array<schema.SelectPostMeta>;
	}

	/**
	 * Post lookup result narrowed to a specific post type.
	 * @example
	 * let found: Post.FoundPostForType<"article"> = {
	 * 	post: { id: "1", authorId: "a1", type: "article", publishedAt: null, createdAt: "", updatedAt: "" },
	 * };
	 */
	export interface FoundPostForType<type extends Type> {
		post: Omit<schema.SelectPost, "type"> & { type: type };
	}

	/**
	 * Typed post lookup result with metadata rows for that post.
	 * @example
	 * let found: Post.FoundPostWithMetaForType<"article"> = {
	 * 	post: { id: "1", authorId: "a1", type: "article", publishedAt: null, createdAt: "", updatedAt: "" },
	 * 	meta: [{ id: "m1", postId: "1", key: "slug", value: "hello-world", createdAt: "", updatedAt: "" }],
	 * };
	 */
	export interface FoundPostWithMetaForType<type extends Type> extends FoundPostForType<type> {
		meta: Array<schema.SelectPostMeta>;
	}
}

/**
 * Base post model with shared persistence and metadata helpers.
 */
export class Post {
	/**
	 * Backing posts table used for all post operations.
	 */
	static table = schema.posts;

	/**
	 * Returns whether a post should be considered publicly published.
	 */
	static isPublishedAt(published_at: string | null) {
		return published_at === null || Date.parse(published_at) <= Date.now();
	}

	/**
	 * Picks the date used for ordering, preferring `published_at` over `created_at`.
	 */
	static timestampFromPublishedOrCreated(input: {
		published_at: string | null;
		created_at: string;
	}) {
		return Date.parse(input.published_at ?? input.created_at);
	}

	/**
	 * Descending comparator using `published_at ?? created_at`.
	 */
	static compareByPublishedOrCreatedDesc(
		a: { published_at: string | null; created_at: string },
		b: { published_at: string | null; created_at: string },
	) {
		return this.timestampFromPublishedOrCreated(b) - this.timestampFromPublishedOrCreated(a);
	}

	/**
	 * Fetches all posts and attaches their metadata rows.
	 * Useful when listing every post regardless of type.
	 * @param db Database client used to run operations.
	 * @returns List of posts with their metadata rows.
	 * @example
	 * let posts = await Post.findAll(db);
	 */
	static async findAll(db: Database): Promise<Array<Post.FoundPost>> {
		let posts = await db.findMany(this.table);

		return await Promise.all(
			posts.map(async (post) => {
				let meta = await PostMeta.findByPostId(db, post.id);
				return { post: post as schema.SelectPost, meta };
			}),
		);
	}

	/**
	 * Finds one post by id and includes its metadata rows.
	 * Returns null when the post does not exist.
	 * @param db Database client used to run operations.
	 * @param id Post id to look up.
	 * @returns Matching post with metadata, or null when missing.
	 * @example
	 * let found = await Post.findById(db, "post_123");
	 */
	static async findById(db: Database, id: string): Promise<Post.FoundPost | null> {
		let post = await db.findOne(this.table, { where: { id } });
		if (!post) return null;

		let meta = await PostMeta.findByPostId(db, post.id);
		return { post: post as schema.SelectPost, meta };
	}

	/**
	 * Finds a post by its slug metadata value.
	 * Resolves the post id from metadata, then loads the full post.
	 * @param db Database client used to run operations.
	 * @param slug Slug value to match.
	 * @returns Matching post with metadata, or null when missing.
	 * @example
	 * let found = await Post.findBySlug(db, "hello-world");
	 */
	static async findBySlug(db: Database, slug: string): Promise<Post.FoundPost | null> {
		let meta = await PostMeta.findByKeyValue(db, "slug", slug);
		if (meta.length === 0) return null;

		let post_id = meta[0]?.post_id;
		if (!post_id) return null;

		return this.findById(db, post_id);
	}

	/**
	 * Fetches all posts written by a specific author.
	 * Each result includes the post metadata rows.
	 * @param db Database client used to run operations.
	 * @param authorId Author id used to filter posts.
	 * @returns List of author posts with metadata.
	 * @example
	 * let posts = await Post.findByAuthorId(db, "author_123");
	 */
	static async findByAuthorId(db: Database, authorId: string): Promise<Array<Post.FoundPost>> {
		let posts = await db.findMany(this.table, {
			where: { author_id: authorId } as Record<string, unknown>,
		});

		return await Promise.all(
			posts.map(async (post) => {
				let meta = await PostMeta.findByPostId(db, post.id);
				return { post: post as schema.SelectPost, meta };
			}),
		);
	}

	/**
	 * Creates a new post and persists provided metadata entries.
	 * Runs post and metadata writes in a single transaction.
	 * @param db Database client used to run operations.
	 * @param input Post creation payload.
	 * @returns Created post with metadata, or null when not found after creation.
	 * @example
	 * let created = await Post.create(db, { authorId: "author_123", type: "article" });
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
	 * Updates a post and upserts metadata values by key.
	 * Creates missing metadata keys and updates existing ones.
	 * @param db Database client used to run operations.
	 * @param id Post id to update.
	 * @param input Post update payload.
	 * @returns Updated post with metadata, or null when the post is missing.
	 * @example
	 * let updated = await Post.update(db, "post_123", { meta: [{ key: "slug", value: "new-slug" }] });
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
			await tx.update(
				this.table,
				{ id },
				{
					author_id: input.author_id ?? existing.author_id,
					type: input.type ?? existing.type,
					published_at: input.published_at ?? existing.published_at,
					updated_at: input.updated_at ?? this.timestamp,
				},
			);

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

				await tx.update(
					PostMeta.table,
					{ id: meta.id },
					{ value: item.value, updated_at: this.timestamp },
				);
			}
		});

		return this.findById(db, id);
	}

	/**
	 * Deletes a post and all of its metadata rows.
	 * Performs all deletes inside a transaction.
	 * @param db Database client used to run operations.
	 * @param id Post id to remove.
	 * @returns True when the delete flow completes.
	 * @example
	 * let ok = await Post.destroy(db, "post_123");
	 */
	static async destroy(db: Database, id: string) {
		let meta = await PostMeta.findByPostId(db, id);

		await db.transaction(async (tx) => {
			for (let item of meta) {
				await tx.delete(PostMeta.table, { id: item.id });
			}
			await tx.delete(this.table, { id });
		});

		return true;
	}

	/**
	 * Lists posts for a specific type with parsed metadata objects.
	 * Converts metadata rows into an object keyed by metadata key.
	 * @param db Database client used to run operations.
	 * @param postType Post type used to filter records.
	 * @returns Typed posts with metadata objects.
	 * @example
	 * let posts = await Post.findAllForType<"article", { slug: string }>(db, "article");
	 */
	static async findAllForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
	) {
		let posts = await db.findMany(this.table, { where: { type: postType } });

		return await Promise.all(
			posts.map(async (post) => {
				let rows = await PostMeta.findByPostId(db, post.id);
				return {
					post: post as Omit<schema.SelectPost, "type"> & { type: type },
					meta: this.metaRowsToObject<meta>(rows),
				};
			}),
		);
	}

	/**
	 * Counts posts for a specific post type using a count query.
	 * @param db Database client used to run operations.
	 * @param postType Post type used to filter records.
	 * @returns Total number of posts matching the requested type.
	 */
	static countForType<type extends Post.Type>(db: Database, postType: type) {
		return db.count(this.table, { where: { type: postType } });
	}

	/**
	 * Finds a typed post by id and parses its metadata object.
	 * Returns null when the id exists but has a different type.
	 * @param db Database client used to run operations.
	 * @param postType Required post type.
	 * @param id Post id to look up.
	 * @returns Typed post with metadata object, or null when not found.
	 * @example
	 * let post = await Post.findByIdForType<"article", { slug: string }>(db, "article", "post_123");
	 */
	static async findByIdForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
		id: string,
	) {
		let found = await this.findById(db, id);
		if (!found) return null;
		if (found.post.type !== postType) return null;

		return {
			post: found.post as Omit<schema.SelectPost, "type"> & { type: type },
			meta: this.metaRowsToObject<meta>(found.meta),
		};
	}

	/**
	 * Finds a typed post by slug and parses its metadata object.
	 * Returns null when slug is missing or the type does not match.
	 * @param db Database client used to run operations.
	 * @param postType Required post type.
	 * @param slug Slug value to match.
	 * @returns Typed post with metadata object, or null when not found.
	 * @example
	 * let post = await Post.findBySlugForType<"article", { slug: string }>(db, "article", "hello-world");
	 */
	static async findBySlugForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
		slug: string,
	) {
		let matches = await PostMeta.findByKeyValue(db, "slug", slug);

		for (let match of matches) {
			let post = await db.findOne(this.table, { where: { id: match.post_id, type: postType } });
			if (!post) continue;

			let rows = await PostMeta.findByPostId(db, post.id);
			return {
				post: post as Omit<schema.SelectPost, "type"> & { type: type },
				meta: this.metaRowsToObject<meta>(rows),
			};
		}

		return null;
	}

	/**
	 * Lists typed posts for one author with parsed metadata objects.
	 * Filters by author id and post type in one query.
	 * @param db Database client used to run operations.
	 * @param postType Required post type.
	 * @param authorId Author id used to filter posts.
	 * @returns Typed author posts with metadata objects.
	 * @example
	 * let posts = await Post.findByAuthorIdForType<"article", { slug: string }>(db, "article", "author_123");
	 */
	static async findByAuthorIdForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
		authorId: string,
	) {
		let posts = await db.findMany(this.table, {
			where: { author_id: authorId, type: postType } as Record<string, unknown>,
		});

		return await Promise.all(
			posts.map(async (post) => {
				let rows = await PostMeta.findByPostId(db, post.id);
				return {
					post: post as Omit<schema.SelectPost, "type"> & { type: type },
					meta: this.metaRowsToObject<meta>(rows),
				};
			}),
		);
	}

	/**
	 * Creates a post for a specific type using typed metadata input.
	 * Serializes metadata object fields into metadata rows.
	 * @param db Database client used to run operations.
	 * @param postType Type assigned to the new post.
	 * @param input Typed creation payload.
	 * @returns Created typed post with parsed metadata, or null when creation fails.
	 * @example
	 * let created = await Post.createForType<"article", { slug: string }>(db, "article", {
	 * 	authorId: "author_123",
	 * 	meta: { slug: "hello-world" },
	 * });
	 */
	static async createForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
		input: Post.TypedCreateInput<meta>,
	): Promise<Post.TypedResult<type, meta> | null> {
		let created = await this.create(db, {
			id: input.id,
			author_id: input.author_id,
			type: postType,
			published_at: input.published_at,
			meta: this.metaObjectToRows(input.meta),
			created_at: input.created_at,
			updated_at: input.updated_at,
		});

		if (!created) return null;

		return {
			post: created.post as Omit<schema.SelectPost, "type"> & { type: type },
			meta: this.metaRowsToObject<meta>(created.meta),
		};
	}

	/**
	 * Updates a typed post and optionally updates typed metadata fields.
	 * Validates the post type before performing updates.
	 * @param db Database client used to run operations.
	 * @param postType Type required for the target post.
	 * @param id Post id to update.
	 * @param input Typed update payload.
	 * @returns Updated typed post with parsed metadata, or null when not found.
	 * @example
	 * let updated = await Post.updateForType<"article", { summary: string }>(db, "article", "post_123", {
	 * 	meta: { summary: "Updated summary" },
	 * });
	 */
	static async updateForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
		id: string,
		input: Post.TypedUpdateInput<meta>,
	): Promise<Post.TypedResult<type, meta> | null> {
		let existing = await db.findOne(this.table, { where: { id, type: postType } });
		if (!existing) return null;

		let metaRows = input.meta ? this.metaObjectToRows(input.meta) : undefined;
		let updated = await this.update(db, id, {
			author_id: input.author_id,
			type: postType,
			published_at: input.published_at,
			meta: metaRows,
			updated_at: input.updated_at,
		});

		if (!updated) return null;

		return {
			post: updated.post as Omit<schema.SelectPost, "type"> & { type: type },
			meta: this.metaRowsToObject<meta>(updated.meta),
		};
	}

	/**
	 * Serializes a metadata object into key/value metadata rows.
	 */
	private static metaObjectToRows(meta: object) {
		let rows: Array<{ key: string; value: string }> = [];

		for (let [key, value] of Object.entries(meta)) {
			if (typeof value === "undefined") continue;

			if (Array.isArray(value)) {
				rows.push({ key, value: JSON.stringify(value) });
				continue;
			}

			rows.push({ key, value: String(value) });
		}

		return rows;
	}

	/**
	 * Hydrates typed metadata object values from metadata rows.
	 */
	private static metaRowsToObject<meta extends object>(rows: Array<schema.SelectPostMeta>): meta {
		let output: Record<string, unknown> = {};

		for (let row of rows) {
			let value = row.value;

			if (value.startsWith("[") && value.endsWith("]")) {
				try {
					let parsed = JSON.parse(value);
					if (Array.isArray(parsed)) {
						output[row.key] = parsed;
						continue;
					}
				} catch {}
			}

			output[row.key] = value;
		}

		return output as meta;
	}

	/**
	 * Generates the current ISO timestamp used for persistence updates.
	 */
	private static get timestamp() {
		return new Date().toISOString();
	}
}
