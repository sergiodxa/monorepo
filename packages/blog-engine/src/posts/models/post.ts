/**
 * Post persistence: the `Post` namespace of input/result types and the `Post` class
 * of generic CRUD plus codec-driven typed helpers. Owns the core `posts` row and its
 * related `post_meta` rows, and the publish-state predicates used everywhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import type { SelectPost, SelectPostMeta } from "../../database/schema";

import { posts } from "../../database/schema";

import { PostMeta } from "./post-meta";

/**
 * Shared type contracts for post persistence and typed metadata mapping.
 *
 * `type` is a plain string (runtime-defined types), `slug` is a core column
 * (unique per type), and `published_at` NULL means draft (not published).
 */
export namespace Post {
	/** Post type discriminator (machine name of a runtime-defined post type). */
	export type Type = string;

	/**
	 * Bidirectional adapter between domain metadata objects and DB key/value rows.
	 * `serialize` is used before writes; `deserialize` is used after reads.
	 */
	export interface MetaCodec<meta extends object> {
		/** Converts partial domain metadata into rows accepted by `post_meta`. */
		serialize(meta: Partial<meta>): Array<{ key: string; value: string }>;
		/** Rebuilds full domain metadata from all rows belonging to one post. */
		deserialize(rows: Array<SelectPostMeta>): meta;
	}

	/** Raw create payload for one post + its metadata rows. */
	export interface CreateInput {
		id?: string;
		slug: string;
		type: Type;
		author_id: string;
		published_at?: string | null;
		meta?: Array<{ key: string; value: string }>;
		created_at?: string;
		updated_at?: string;
	}

	/** Mutable fields for a post update (metadata upserted by key). */
	export interface UpdateInput {
		slug?: string;
		author_id?: string;
		published_at?: string | null;
		meta?: Array<{ key: string; value: string }>;
		updated_at?: string;
	}

	/** Typed create payload for one concrete post type. */
	export interface TypedCreateInput<meta extends object> {
		id?: string;
		slug: string;
		author_id: string;
		published_at?: string | null;
		meta: meta;
		created_at?: string;
		updated_at?: string;
	}

	/** Typed update payload for one concrete post type. */
	export interface TypedUpdateInput<meta extends object> {
		slug?: string;
		author_id?: string;
		published_at?: string | null;
		meta?: Partial<meta>;
		updated_at?: string;
	}

	/** Raw post row with all related metadata rows attached. */
	export interface FoundPost extends SelectPost {
		meta: Array<SelectPostMeta>;
	}

	/** Post row narrowed to a concrete type with decoded metadata. */
	export type TypedResult<meta extends object> = SelectPost & { meta: meta };

	/** LIMIT/OFFSET pagination for list reads. */
	export interface Pagination {
		limit?: number;
		offset?: number;
	}
}

/**
 * Data access and typed mapping helpers for posts and their metadata rows.
 * Owns generic CRUD; per-type wrappers (see {@link ./article.ts}) provide codecs.
 */
export class Post {
	/** Table reference used by all post read/write operations. */
	static table = posts;

	/**
	 * Reports whether a `published_at` value is public right now (NULL = draft, a
	 * future date = scheduled and not yet public).
	 * @param published_at - The stored publish timestamp, or null.
	 * @returns True when the post is published and visible now.
	 */
	static isPublished(published_at: string | null): boolean {
		if (published_at === null) return false;
		let timestamp = Date.parse(published_at);
		if (Number.isNaN(timestamp)) return false;
		return timestamp <= Date.now();
	}

	/**
	 * Reports whether a post is scheduled (a valid `published_at` in the future).
	 * @param published_at - The stored publish timestamp, or null.
	 * @returns True when the post is scheduled for a future time.
	 */
	static isScheduled(published_at: string | null): boolean {
		if (published_at === null) return false;
		let timestamp = Date.parse(published_at);
		if (Number.isNaN(timestamp)) return false;
		return timestamp > Date.now();
	}

	/**
	 * Newest-first comparator using `published_at`, falling back to `created_at`
	 * (suitable for `Array.prototype.sort`).
	 * @param a - The first post to compare.
	 * @param b - The second post to compare.
	 * @returns A negative/zero/positive number ordering `b` before `a` by date.
	 */
	static compareByDateDesc(
		a: { published_at: string | null; created_at: string },
		b: { published_at: string | null; created_at: string },
	): number {
		let av = Date.parse(a.published_at ?? a.created_at);
		let bv = Date.parse(b.published_at ?? b.created_at);
		return (Number.isNaN(bv) ? 0 : bv) - (Number.isNaN(av) ? 0 : av);
	}

	/**
	 * Lists posts (optionally filtered by type), newest first, each with its metadata
	 * rows attached. Sorting and pagination happen in memory after the read.
	 * @param db - Database handle.
	 * @param options.type - Restrict to one post type.
	 * @param options.pagination - LIMIT/OFFSET applied after sorting.
	 * @returns The matching posts with metadata.
	 */
	static async findMany(
		db: Database,
		options: { type?: Post.Type; pagination?: Post.Pagination } = {},
	): Promise<Array<Post.FoundPost>> {
		let where = options.type ? { type: options.type } : undefined;
		let rows = await db.findMany(this.table, where ? { where } : undefined);
		let sorted = rows.sort((a, b) => this.compareByDateDesc(a, b));

		let offset = options.pagination?.offset ?? 0;
		let limit = options.pagination?.limit;
		let page = limit === undefined ? sorted.slice(offset) : sorted.slice(offset, offset + limit);

		return this.attachMeta(db, page);
	}

	/**
	 * Counts posts of one type.
	 * @param db - Database handle.
	 * @param type - The post type machine name.
	 * @returns The number of posts of that type.
	 */
	static async count(db: Database, type: Post.Type): Promise<number> {
		return db.count(this.table, { where: { type } });
	}

	/**
	 * Finds one post by id with its metadata attached.
	 * @param db - Database handle.
	 * @param id - The post id.
	 * @returns The post with metadata, or `null` when not found.
	 */
	static async findById(db: Database, id: string): Promise<Post.FoundPost | null> {
		let post = await db.findOne(this.table, { where: { id } });
		if (!post) return null;
		let meta = await PostMeta.findByPostId(db, id);
		return { ...post, meta };
	}

	/**
	 * Finds one post by its (type, slug) pair — a single indexed lookup — with
	 * metadata attached.
	 * @param db - Database handle.
	 * @param type - The post type machine name.
	 * @param slug - The post slug (unique within the type).
	 * @returns The post with metadata, or `null` when not found.
	 */
	static async findBySlug(
		db: Database,
		type: Post.Type,
		slug: string,
	): Promise<Post.FoundPost | null> {
		let post = await db.findOne(this.table, { where: { type, slug } });
		if (!post) return null;
		let meta = await PostMeta.findByPostId(db, post.id);
		return { ...post, meta };
	}

	/**
	 * Creates a post row and its metadata rows atomically in one transaction, then
	 * reads the result back.
	 * @param db - Database handle.
	 * @param input - Core columns plus optional metadata rows.
	 * @returns The created post with metadata, or `null` if the read-back fails.
	 */
	static async create(db: Database, input: Post.CreateInput): Promise<Post.FoundPost | null> {
		let now = this.timestamp;
		let id = input.id ?? crypto.randomUUID();
		let meta = input.meta ?? [];

		await db.transaction(async (tx) => {
			await tx.create(this.table, {
				id,
				slug: input.slug,
				type: input.type,
				author_id: input.author_id,
				published_at: input.published_at ?? null,
				created_at: input.created_at ?? now,
				updated_at: input.updated_at ?? now,
			});
			for (let item of meta) {
				await PostMeta.create(tx, { post_id: id, key: item.key, value: item.value });
			}
		});

		return this.findById(db, id);
	}

	/**
	 * Updates a post row and upserts its metadata entries by key (existing keys are
	 * updated, new keys inserted) in one transaction.
	 * @param db - Database handle.
	 * @param id - The post id to update.
	 * @param input - Fields to change; omitted fields keep their current value.
	 * @returns The updated post with metadata, or `null` when not found.
	 */
	static async update(
		db: Database,
		id: string,
		input: Post.UpdateInput,
	): Promise<Post.FoundPost | null> {
		let existing = await db.findOne(this.table, { where: { id } });
		if (!existing) return null;

		let metaUpdates = input.meta ?? [];
		let existingByKey = new Map<string, SelectPostMeta>();
		if (metaUpdates.length > 0) {
			for (let row of await PostMeta.findByPostId(db, id)) {
				if (!existingByKey.has(row.key)) existingByKey.set(row.key, row);
			}
		}

		await db.transaction(async (tx) => {
			await tx.update(
				this.table,
				{ id },
				{
					slug: input.slug ?? existing.slug,
					author_id: input.author_id ?? existing.author_id,
					published_at:
						input.published_at === undefined ? existing.published_at : input.published_at,
					updated_at: input.updated_at ?? this.timestamp,
				},
			);
			for (let item of metaUpdates) {
				let row = existingByKey.get(item.key);
				if (!row) {
					await PostMeta.create(tx, { post_id: id, key: item.key, value: item.value });
					continue;
				}
				await tx.update(
					PostMeta.table,
					{ id: row.id },
					{ value: item.value, updated_at: this.timestamp },
				);
			}
		});

		return this.findById(db, id);
	}

	/**
	 * Deletes a post by id; its `post_meta` rows cascade in SQL.
	 * @param db - Database handle.
	 * @param id - The post id to delete.
	 * @returns Always `true` once the delete has been issued.
	 */
	static async destroy(db: Database, id: string): Promise<boolean> {
		await db.delete(this.table, { id });
		return true;
	}

	/**
	 * Reassigns every post of one author to another (used before deleting a user).
	 * @param db - Database handle.
	 * @param fromId - The current author id.
	 * @param toId - The new author id.
	 */
	static async reassignAuthor(db: Database, fromId: string, toId: string): Promise<void> {
		let rows = await db.findMany(this.table, { where: { author_id: fromId } });
		for (let row of rows) {
			await db.update(this.table, { id: row.id }, { author_id: toId, updated_at: this.timestamp });
		}
	}

	/**
	 * Counts posts authored by a user (used to gate user deletion).
	 * @param db - Database handle.
	 * @param authorId - The author's user id.
	 * @returns The number of posts authored by that user.
	 */
	static countByAuthor(db: Database, authorId: string): Promise<number> {
		return db.count(this.table, { where: { author_id: authorId } });
	}

	// ---- Typed helpers (codec-driven) ----

	/**
	 * Lists typed posts for one type, decoding each post's metadata via the codec.
	 * @param db - Database handle.
	 * @param type - The post type machine name.
	 * @param codec - Codec mapping metadata rows to the typed shape.
	 * @param pagination - Optional LIMIT/OFFSET.
	 * @returns The posts with decoded, typed metadata.
	 */
	static async findManyForType<meta extends object>(
		db: Database,
		type: Post.Type,
		codec: Post.MetaCodec<meta>,
		pagination?: Post.Pagination,
	): Promise<Array<Post.TypedResult<meta>>> {
		let found = await this.findMany(db, { type, pagination });
		return found.map((post) => this.toTyped(post, codec));
	}

	/**
	 * Finds a typed post by id, requiring it to belong to the given type.
	 * @param db - Database handle.
	 * @param type - The expected post type machine name.
	 * @param id - The post id.
	 * @param codec - Codec decoding the metadata.
	 * @returns The typed post, or `null` when missing or of another type.
	 */
	static async findByIdForType<meta extends object>(
		db: Database,
		type: Post.Type,
		id: string,
		codec: Post.MetaCodec<meta>,
	): Promise<Post.TypedResult<meta> | null> {
		let found = await this.findById(db, id);
		if (!found || found.type !== type) return null;
		return this.toTyped(found, codec);
	}

	/**
	 * Finds a typed post by its (type, slug) pair.
	 * @param db - Database handle.
	 * @param type - The post type machine name.
	 * @param slug - The post slug.
	 * @param codec - Codec decoding the metadata.
	 * @returns The typed post, or `null` when not found.
	 */
	static async findBySlugForType<meta extends object>(
		db: Database,
		type: Post.Type,
		slug: string,
		codec: Post.MetaCodec<meta>,
	): Promise<Post.TypedResult<meta> | null> {
		let found = await this.findBySlug(db, type, slug);
		if (!found) return null;
		return this.toTyped(found, codec);
	}

	/**
	 * Creates a typed post, serializing its metadata via the codec.
	 * @param db - Database handle.
	 * @param type - The post type machine name.
	 * @param input - Typed create payload (slug, author, metadata, …).
	 * @param codec - Codec serializing/deserializing the metadata.
	 * @returns The created typed post, or `null` if the read-back fails.
	 */
	static async createForType<meta extends object>(
		db: Database,
		type: Post.Type,
		input: Post.TypedCreateInput<meta>,
		codec: Post.MetaCodec<meta>,
	): Promise<Post.TypedResult<meta> | null> {
		let created = await this.create(db, {
			id: input.id,
			slug: input.slug,
			type,
			author_id: input.author_id,
			published_at: input.published_at,
			meta: codec.serialize(input.meta),
			created_at: input.created_at,
			updated_at: input.updated_at,
		});
		return created ? this.toTyped(created, codec) : null;
	}

	/**
	 * Updates a typed post, serializing changed metadata via the codec. Requires the
	 * post to exist and belong to the given type.
	 * @param db - Database handle.
	 * @param type - The expected post type machine name.
	 * @param id - The post id to update.
	 * @param input - Typed update payload (partial metadata allowed).
	 * @param codec - Codec serializing/deserializing the metadata.
	 * @returns The updated typed post, or `null` when missing or mismatched.
	 */
	static async updateForType<meta extends object>(
		db: Database,
		type: Post.Type,
		id: string,
		input: Post.TypedUpdateInput<meta>,
		codec: Post.MetaCodec<meta>,
	): Promise<Post.TypedResult<meta> | null> {
		let existing = await db.findOne(this.table, { where: { id, type } });
		if (!existing) return null;
		let updated = await this.update(db, id, {
			slug: input.slug,
			author_id: input.author_id,
			published_at: input.published_at,
			meta: input.meta ? codec.serialize(input.meta) : undefined,
			updated_at: input.updated_at,
		});
		return updated ? this.toTyped(updated, codec) : null;
	}

	private static async attachMeta(
		db: Database,
		rows: Array<SelectPost>,
	): Promise<Array<Post.FoundPost>> {
		return Promise.all(
			rows.map(async (post) => ({ ...post, meta: await PostMeta.findByPostId(db, post.id) })),
		);
	}

	private static toTyped<meta extends object>(
		post: Post.FoundPost,
		codec: Post.MetaCodec<meta>,
	): Post.TypedResult<meta> {
		let { meta, ...row } = post;
		return { ...row, meta: codec.deserialize(meta) };
	}

	/** Current wall-clock time in ISO-8601 UTC. */
	private static get timestamp(): string {
		return new Date().toISOString();
	}
}
