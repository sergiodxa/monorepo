import type { Database } from "remix/data-table";

import { inList } from "remix/data-table";

import * as schema from "~/app/models";
import { PostMeta } from "~/app/repositories/post-meta";

export namespace Post {
	export type Type = schema.SelectPost["type"];

	export type MetaObject = object;

	export interface MetaCodec<meta extends object> {
		serialize(meta: Partial<meta>): Array<{ key: string; value: string }>;
		deserialize(rows: Array<schema.SelectPostMeta>): meta;
	}

	export interface CreateInput {
		id?: string;
		author_id: string;
		type: Type;
		published_at?: string | null;
		meta?: Array<Omit<schema.InsertPostMeta, "post_id">>;
		created_at?: string;
		updated_at?: string;
	}

	export interface UpdateInput {
		author_id?: string;
		type?: Type;
		published_at?: string | null;
		meta?: Array<{ key: string; value: string }>;
		updated_at?: string;
	}

	export interface TypedCreateInput<meta extends object> {
		id?: string;
		author_id: string;
		published_at?: string | null;
		meta: meta;
		created_at?: string;
		updated_at?: string;
	}

	export interface TypedUpdateInput<meta extends object> {
		author_id?: string;
		published_at?: string | null;
		meta?: Partial<meta>;
		updated_at?: string;
	}

	export type TypedResult<type extends Type, meta extends object> = Omit<
		schema.SelectPost,
		"type"
	> & {
		type: type;
		meta: meta;
	};

	export interface FoundPost extends schema.SelectPost {
		meta: Array<schema.SelectPostMeta>;
	}

	export interface FoundPostForType<type extends Type> {
		post: Omit<schema.SelectPost, "type"> & { type: type };
	}

	export interface FoundPostWithMetaForType<type extends Type> extends FoundPostForType<type> {
		meta: Array<schema.SelectPostMeta>;
	}
}

export class Post {
	static table = schema.posts;

	/** `null` is treated as published; future dates are previews. */
	static isPublishedAt(published_at: string | null) {
		return published_at === null || Date.parse(published_at) <= Date.now();
	}

	static timestampFromPublishedOrCreated(input: {
		published_at: string | null;
		created_at: string;
	}) {
		let value = input.published_at ?? input.created_at;
		return this.parseTimestamp(value);
	}

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

	static compareByPublishedOrCreatedDesc(
		a: { published_at: string | null; created_at: string },
		b: { published_at: string | null; created_at: string },
	) {
		return this.timestampFromPublishedOrCreated(b) - this.timestampFromPublishedOrCreated(a);
	}

	static async findAll(db: Database): Promise<Array<Post.FoundPost>> {
		let posts = await db.query(this.table).orderBy("created_at", "desc").all();

		return this.attachMetaToPosts(db, posts);
	}

	static async findById(db: Database, id: string): Promise<Post.FoundPost | null> {
		let posts = await this.findManyByIds(db, [id]);
		return posts[0] ?? null;
	}

	static async findBySlug(db: Database, slug: string): Promise<Post.FoundPost | null> {
		let meta = await PostMeta.findByKeyValue(db, "slug", slug);
		if (meta.length === 0) return null;

		let post_id = meta[0]?.post_id;
		if (!post_id) return null;

		return this.findById(db, post_id);
	}

	static async findByAuthorId(db: Database, authorId: string): Promise<Array<Post.FoundPost>> {
		let posts = await db.findMany(this.table, {
			where: { author_id: authorId } as Record<string, unknown>,
		});

		return this.attachMetaToPosts(db, posts);
	}

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

	/** Updates post fields and upserts metadata by key. */
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

	static async destroy(db: Database, id: string) {
		await db.delete(this.table, id);
		return true;
	}

	/** Fetches typed posts and hydrates metadata rows into objects. */
	static async findAllForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
		codec: Post.MetaCodec<meta>,
	) {
		let posts = await db
			.query(this.table)
			.orderBy("created_at", "desc")
			.where({ type: postType })
			.all();

		let withMeta = await this.attachMetaToPosts(db, posts);

		return withMeta.map((post) => this.toTypedResult<type, meta>(postType, post, codec));
	}

	static countForType<type extends Post.Type>(db: Database, postType: type) {
		return db.count(this.table, { where: { type: postType } });
	}

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

	/** Handles slug collisions by returning the first matching post of `postType`. */
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

	static async findByAuthorIdForType<type extends Post.Type, meta extends object>(
		db: Database,
		postType: type,
		authorId: string,
		codec: Post.MetaCodec<meta>,
	) {
		let posts = await db.findMany(this.table, {
			where: { author_id: authorId, type: postType } as Record<string, unknown>,
		});

		let withMeta = await this.attachMetaToPosts(db, posts);

		return withMeta.map((post) => this.toTypedResult<type, meta>(postType, post, codec));
	}

	private static async findManyByIds(
		db: Database,
		ids: Array<string>,
	): Promise<Array<Post.FoundPost>> {
		if (ids.length === 0) return [];

		let posts = await db.query(this.table).where(inList(this.table.id, ids)).all();

		return this.attachMetaToPosts(db, posts);
	}

	private static async attachMetaToPosts(
		db: Database,
		posts: Array<schema.SelectPost>,
	): Promise<Array<Post.FoundPost>> {
		if (posts.length === 0) return [];

		let postIds = posts.map((post) => post.id);
		let metaRows = await PostMeta.findByPostIds(db, postIds);
		let metaByPostId = new Map<string, Array<schema.SelectPostMeta>>();

		for (let post of posts) {
			metaByPostId.set(post.id, []);
		}

		for (let row of metaRows) {
			let rows = metaByPostId.get(row.post_id);
			if (!rows) continue;

			rows.push(row);
		}

		return posts.map((post) => ({ ...post, meta: metaByPostId.get(post.id) ?? [] }));
	}

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

	private static toTypedResult<type extends Post.Type, meta extends object>(
		postType: type,
		post: Post.FoundPost,
		codec: Post.MetaCodec<meta>,
	): Post.TypedResult<type, meta> {
		let { meta: metaRows, ...postRow } = post;
		return { ...postRow, type: postType, meta: codec.deserialize(metaRows) };
	}

	private static get timestamp() {
		return new Date().toISOString();
	}
}
