/**
 * Post repository for blog and the core of its content model. Owns generic
 * post CRUD, publish-date semantics, timestamp normalization, joined post+meta
 * reads, and typed per-type mapping via codecs for articles, tutorials, etc.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { and, eq, inList, isNull, notNull, sql } from "remix/data-table";

import { PostMeta } from "~/app/repositories/post-meta";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { PostSearch } from "~/app/repositories/search";
import * as schema from "~/database/schema";

import { ArticlePost } from "./posts/article";

/**
 * Shared type contracts for post persistence and typed metadata mapping.
 *
 * Types only, so typed wrappers around generic post rows stay compile-time.
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
	 * Article and tutorial shapes differ so controllers render route-specific UI
	 * straight from the payload.
	 */
	export type PublicFoundByTypeAndSlug =
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
				};
		  }
		| {
				postType: "tutorials";
				post: {
					id: string;
					meta: {
						title: string;
						slug: string;
						excerpt?: string;
						content: string;
					};
					published_at: string | null;
					created_at: string;
					/** When the post or its content last changed, which an EPUB reports as its `modified`. */
					updated_at: string;
				};
				tags: Array<string>;
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

	/** A published article or tutorial in the order the ActivityPub outbox lists it. */
	export interface Federatable {
		id: string;
		/** Epoch milliseconds of its publish date, else its creation date. */
		timestamp: number;
	}

	/** Tutorial related-post summary matched through one shared tag. */
	export interface RelatedByTypeItem {
		slug: string;
		title: string;
		matchedTag: string;
	}
}

/**
 * The latest value stored under a metadata key, since an edit can leave more than one
 * row for it; `undefined` when the key was never written.
 */
function latestMeta(rows: Array<schema.SelectPostMeta>, key: string): string | undefined {
	let matching = rows.filter((row) => row.key === key);
	matching.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
	return matching[0]?.value;
}

/** The stored `posts.type` behind each public collection path. */
const PUBLIC_TYPES = { articles: "article", tutorials: "tutorial" } as const;

/** A post permalink: `/articles/:slug` or `/tutorials/:slug`, without an extension. */
const MENTIONABLE_PATH = /^\/(articles|tutorials)\/([^/.]+)$/;

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
	 * Contract: `null` means immediately published, and an unparsable timestamp
	 * counts as unpublished.
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
	private static parseTimestamp(value: string | number | null | undefined) {
		if (value === null || value === undefined) return Number.NaN;

		if (typeof value === "number") {
			if (!Number.isFinite(value)) return Number.NaN;
			if (value > 1_000_000_000_000) return value;
			return value * 1000;
		}

		let text = value;
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
				},
			};
		}

		let post = await TutorialPost.findBySlug(db, input.postSlug);
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
	 * Reads what sending a post's Webmentions needs, deleted posts included, since a
	 * delete notifies every target the post had linked.
	 *
	 * @param db Database handle used for lookups.
	 * @param id Post identifier.
	 * @returns The article or tutorial with its Markdown source, or `null` for any other post.
	 */
	static async findForMentions(db: Database, id: string): Promise<Post.MentionSource | null> {
		let post = await db.findOne(this.table, { where: { id } });
		if (!post) return null;
		let postType: Post.PublicTypePath;
		if (post.type === "article") postType = "articles";
		else if (post.type === "tutorial") postType = "tutorials";
		else return null;

		let meta = await PostMeta.findByPostId(db, id);
		return {
			id: post.id,
			postType,
			slug: latestMeta(meta, "slug") ?? post.id,
			content: latestMeta(meta, "content") ?? "",
			published_at: post.published_at,
			deleted_at: post.deleted_at,
			federated_at: post.federated_at,
		};
	}

	/**
	 * Articles and tutorials whose scheduled publish date has arrived since they last sent
	 * their Webmentions. A post published on save sends from the CMS and never lands here.
	 *
	 * @param db Database handle used for lookups.
	 * @returns The ids of the posts due to send.
	 */
	static async findDueForMentions(db: Database): Promise<string[]> {
		let rows = await db.findMany(this.table, {
			where: and(
				inList("type", ["article", "tutorial"]),
				isNull("deleted_at"),
				notNull("published_at"),
			),
		});

		return rows
			.filter((row) => {
				if (row.published_at === null || !this.isPublishedAt(row.published_at)) return false;
				if (row.mentions_sent_at === null) return true;
				return this.parseTimestamp(row.mentions_sent_at) < this.parseTimestamp(row.published_at);
			})
			.map((row) => row.id);
	}

	/**
	 * Articles and tutorials whose scheduled publish date has arrived and whose `Create`
	 * followers never received. A post published on save federates from the CMS, and one
	 * already public when federation started counts as federated, so neither lands here.
	 *
	 * @param db Database handle used for lookups.
	 * @returns The ids of the posts due to federate.
	 */
	static async findDueForFederation(db: Database): Promise<string[]> {
		let rows = await db.findMany(this.table, {
			where: and(
				inList("type", ["article", "tutorial"]),
				isNull("deleted_at"),
				isNull("federated_at"),
				notNull("published_at"),
			),
		});
		return rows.filter((row) => this.isPublishedAt(row.published_at)).map((row) => row.id);
	}

	/**
	 * The published, live articles and tutorials, newest first with the id breaking a tie,
	 * which is the order the outbox pages through and the count NodeInfo reports.
	 *
	 * @param db Database handle used for lookups.
	 */
	static async findFederatable(db: Database): Promise<Post.Federatable[]> {
		let rows = await db.findMany(this.table, {
			where: and(inList("type", ["article", "tutorial"]), isNull("deleted_at")),
		});
		return rows
			.filter((row) => this.isPublishedAt(row.published_at))
			.map((row) => ({ id: row.id, timestamp: this.timestampFromPublishedOrCreated(row) }))
			.filter((row) => Number.isFinite(row.timestamp))
			.sort((a, b) => b.timestamp - a.timestamp || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
	}

	/**
	 * Stamps a post as sent to its followers, leaving `updated_at` alone because nothing a
	 * reader sees changed. One statement, so it is safe on D1.
	 *
	 * @param db Database handle used for writes.
	 * @param id Post identifier.
	 */
	static async markFederated(db: Database, id: string) {
		await db.exec(sql`update "posts" set "federated_at" = ${this.timestamp} where "id" = ${id}`);
	}

	/**
	 * Stamps a post as having sent its Webmentions now, which takes it off the cron's list
	 * until its publish date moves past this moment.
	 *
	 * @param db Database handle used for writes.
	 * @param id Post identifier.
	 */
	static async markMentionsSent(db: Database, id: string) {
		let now = this.timestamp;
		await db.update(this.table, id, { mentions_sent_at: now, updated_at: now });
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
	 * Creates a post row and optional metadata rows in one transaction, then writes the
	 * post's search document so a search finds it from its publish date on.
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

		await PostSearch.index(db, id, input.type);

		return this.findById(db, id);
	}

	/**
	 * Updates a post row and upserts metadata entries by key.
	 *
	 * Existing metadata keys are updated in place; unseen keys are inserted. The post's
	 * search document is rewritten afterwards, so a search sees the edit.
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

		let type = input.type ?? existing.type;

		await db.transaction(async (tx) => {
			await tx.update(this.table, id, {
				author_id: input.author_id ?? existing.author_id,
				type,
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

		await PostSearch.index(db, id, type);

		return this.findById(db, id);
	}

	/**
	 * Deletes a post by leaving a tombstone: the row and its metadata stay, every read
	 * skips it, and its URL answers 410 Gone so Webmention receivers learn it was withdrawn.
	 * Its search document goes with it, so no search returns a deleted post.
	 *
	 * @param db Database handle used for writes.
	 * @param id Post identifier.
	 * @returns `true` when a live post was tombstoned, `false` when none matched.
	 */
	static async destroy(db: Database, id: string) {
		let existing = await db.findOne(this.table, { where: and({ id }, isNull("deleted_at")) });
		if (!existing) return false;

		let now = this.timestamp;
		await db.update(this.table, id, { deleted_at: now, updated_at: now });
		await PostSearch.remove(db, id);
		return true;
	}

	/**
	 * Whether a public URL belonged to a post that was deleted, so the page answers
	 * 410 Gone rather than 404; a live post reusing the slug takes precedence upstream.
	 *
	 * @param db Database handle used for lookups.
	 * @param input Route-like lookup input.
	 */
	static async isTombstoned(
		db: Database,
		input: { postType: Post.PublicTypePath; postSlug: string },
	): Promise<boolean> {
		return (await this.findTombstone(db, input)) !== null;
	}

	/**
	 * The deleted post a public URL belonged to, with when it was deleted, which the
	 * ActivityPub `Tombstone` it is served as carries; `null` when no deleted post had it.
	 *
	 * @param db Database handle used for lookups.
	 * @param input Route-like lookup input.
	 */
	static async findTombstone(
		db: Database,
		input: { postType: Post.PublicTypePath; postSlug: string },
	): Promise<{ deleted_at: string } | null> {
		let type = PUBLIC_TYPES[input.postType];
		let matches = await PostMeta.findByKeyValue(db, "slug", input.postSlug);
		for (let match of matches) {
			let post = await db.findOne(this.table, {
				where: and({ id: match.post_id, type }, notNull("deleted_at")),
			});
			if (post?.deleted_at) return { deleted_at: post.deleted_at };
		}
		return null;
	}

	/**
	 * Resolves a URL on this site to the published article or tutorial it names, which is
	 * what the Webmention endpoint accepts mentions for. Another origin, another path, an
	 * extension, a preview or a deleted post all resolve to `null`.
	 *
	 * @param db Database handle used for lookups.
	 * @param target The URL a Webmention names as its target.
	 * @param origin This site's origin, the only one whose posts are accepted.
	 */
	static async findMentionable(
		db: Database,
		target: URL,
		origin: string,
	): Promise<{ id: string; postType: Post.PublicTypePath; postSlug: string } | null> {
		if (target.origin !== origin) return null;

		let match = MENTIONABLE_PATH.exec(target.pathname);
		let postType = match?.[1];
		let postSlug = match?.[2];
		if (postType !== "articles" && postType !== "tutorials") return null;
		if (postSlug === undefined) return null;

		let found = await this.findByTypeAndSlug(db, {
			postType,
			postSlug: decodeURIComponent(postSlug),
		});
		if (!found || !this.isPublishedAt(found.post.published_at)) return null;

		return { id: found.post.id, postType, postSlug: found.post.meta.slug };
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
		return db.count(this.table, { where: and({ type: postType }, isNull("deleted_at")) });
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
	 * An empty `ids` list returns immediately, leaving callers free to pass
	 * unfiltered lists.
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
	 * Plain predicates are the paths the app's adapter executes reliably, so feed
	 * and list reads stay batched in a single query.
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
				deleted_at: this.table.deleted_at,
				mentions_sent_at: this.table.mentions_sent_at,
				federated_at: this.table.federated_at,
				meta_id: schema.postMeta.id,
				meta_created_at: schema.postMeta.created_at,
				meta_updated_at: schema.postMeta.updated_at,
				meta_post_id: schema.postMeta.post_id,
				meta_key: schema.postMeta.key,
				meta_value: schema.postMeta.value,
			})
			.orderBy("posts.created_at", "desc");

		if (where?.type) {
			return query.where(and({ type: where.type }, isNull(this.table.deleted_at))).all();
		}

		return query.where(isNull(this.table.deleted_at)).all();
	}

	/**
	 * Loads one post plus its metadata as two direct queries the adapter runs
	 * reliably.
	 */
	private static async findOneJoinedById(db: Database, id: string): Promise<Post.FoundPost | null> {
		let post = await db.findOne(this.table, { where: and({ id }, isNull("deleted_at")) });
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
			deleted_at: string | null;
			mentions_sent_at: string | null;
			federated_at: string | null;
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
					deleted_at: row.deleted_at,
					mentions_sent_at: row.mentions_sent_at,
					federated_at: row.federated_at,
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

	/** ISO-8601 UTC string stamped on every repository-written timestamp. */
	private static get timestamp() {
		return new Date().toISOString();
	}
}
