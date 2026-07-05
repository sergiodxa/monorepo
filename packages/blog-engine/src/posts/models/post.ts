import type { Database } from "remix/data-table";

import type { SelectPost, SelectPostMeta } from "../../database/schema";

import { posts } from "../../database/schema";

import { PostMeta } from "./post-meta";

/**
 * Shared type contracts for post persistence and typed metadata mapping.
 *
 * Generalized from `apps/r3-blog/app/repositories/post.ts`: `type` is a plain
 * string (runtime-defined types), `slug` is a core column (unique per type), and
 * `published_at` NULL means draft (not published).
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

	/** Returns whether a `published_at` value is public right now (NULL = draft). */
	static isPublished(published_at: string | null): boolean {
		if (published_at === null) return false;
		let timestamp = Date.parse(published_at);
		if (Number.isNaN(timestamp)) return false;
		return timestamp <= Date.now();
	}

	/** True when a post is scheduled (a future `published_at`). */
	static isScheduled(published_at: string | null): boolean {
		if (published_at === null) return false;
		let timestamp = Date.parse(published_at);
		if (Number.isNaN(timestamp)) return false;
		return timestamp > Date.now();
	}

	/** Newest-first comparator using `published_at`, falling back to `created_at`. */
	static compareByDateDesc(
		a: { published_at: string | null; created_at: string },
		b: { published_at: string | null; created_at: string },
	): number {
		let av = Date.parse(a.published_at ?? a.created_at);
		let bv = Date.parse(b.published_at ?? b.created_at);
		return (Number.isNaN(bv) ? 0 : bv) - (Number.isNaN(av) ? 0 : av);
	}

	/** Lists posts (optionally filtered by type), newest first, with metadata. */
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

	/** Counts posts of one type. */
	static async count(db: Database, type: Post.Type): Promise<number> {
		return db.count(this.table, { where: { type } });
	}

	/** Finds one post by id with metadata attached. */
	static async findById(db: Database, id: string): Promise<Post.FoundPost | null> {
		let post = await db.findOne(this.table, { where: { id } });
		if (!post) return null;
		let meta = await PostMeta.findByPostId(db, id);
		return { ...post, meta };
	}

	/** Finds one post by (type, slug) — a single indexed lookup — with metadata. */
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

	/** Creates a post row and its metadata rows in one transaction. */
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

	/** Updates a post row and upserts metadata entries by key. */
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

	/** Deletes a post by id (post_meta cascades in SQL). */
	static async destroy(db: Database, id: string): Promise<boolean> {
		await db.delete(this.table, { id });
		return true;
	}

	/** Reassigns every post of one author to another (used before user deletion). */
	static async reassignAuthor(db: Database, fromId: string, toId: string): Promise<void> {
		let rows = await db.findMany(this.table, { where: { author_id: fromId } });
		for (let row of rows) {
			await db.update(this.table, { id: row.id }, { author_id: toId, updated_at: this.timestamp });
		}
	}

	/** Counts posts authored by a user (used to gate user deletion). */
	static countByAuthor(db: Database, authorId: string): Promise<number> {
		return db.count(this.table, { where: { author_id: authorId } });
	}

	// ---- Typed helpers (codec-driven) ----

	/** Lists typed posts for one type with decoded metadata. */
	static async findManyForType<meta extends object>(
		db: Database,
		type: Post.Type,
		codec: Post.MetaCodec<meta>,
		pagination?: Post.Pagination,
	): Promise<Array<Post.TypedResult<meta>>> {
		let found = await this.findMany(db, { type, pagination });
		return found.map((post) => this.toTyped(post, codec));
	}

	/** Finds a typed post by id. */
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

	/** Finds a typed post by (type, slug). */
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

	/** Creates a typed post via its codec. */
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

	/** Updates a typed post via its codec. */
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
