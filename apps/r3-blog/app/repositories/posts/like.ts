/**
 * Repository for `like` posts (liked links/bookmarks), scoping the shared `Post`
 * model to the `like` post type. It defines the title/url metadata shape, a codec
 * to/from `post_meta` rows, standard CRUD/count helpers, and utilities to
 * normalize a URL and build a Wayback Machine snapshot URL from `created_at`.
 * Exists to give callers type-safe like persistence and link helpers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Post } from "~/app/repositories/post";

/**
 * Type contracts for the `like` post repository.
 *
 * These types model the metadata shape persisted in `post_meta` rows
 * and the input payloads accepted by create/update operations.
 */
export namespace LikePost {
	/**
	 * Metadata persisted for a like post.
	 *
	 * `title` is the display label and `url` is the liked target.
	 */
	export interface Meta {
		/** Human-readable label shown for the liked URL. */
		title: string;
		/** Absolute or site-relative URL that this like points to. */
		url: string;
	}

	/**
	 * Input accepted when creating a like post.
	 *
	 * Must include base post fields plus `Meta` values encoded in `meta`.
	 */
	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	/**
	 * Input accepted when updating a like post.
	 *
	 * Supports partial base post changes and partial metadata updates.
	 */
	export interface UpdateInput extends Post.TypedUpdateInput<Meta> {}
}

/**
 * Picks the effective metadata value for a key from duplicated rows.
 *
 * Rows are deterministically ordered to avoid DB-order dependence when
 * historical writes produce multiple entries for the same key.
 *
 * @param rows Metadata rows as returned by the post query.
 * @param key Metadata key to resolve.
 * @returns The first value for `key` after stable ordering, or `undefined`.
 */
function likeMetaValue(
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
 * Metadata codec used by generic `Post.*ForType` helpers.
 *
 * Serialization emits only defined fields. Deserialization resolves the
 * latest row per key and falls back to empty strings for missing metadata.
 */
let likeMetaCodec: Post.MetaCodec<LikePost.Meta> = {
	/**
	 * Converts typed metadata into key/value rows for persistence.
	 *
	 * @param meta Typed metadata payload.
	 * @returns Persistable key/value rows for `post_meta`.
	 */
	serialize(meta) {
		let rows: Array<{ key: string; value: string }> = [];
		if (typeof meta.title !== "undefined") rows.push({ key: "title", value: meta.title });
		if (typeof meta.url !== "undefined") rows.push({ key: "url", value: meta.url });
		return rows;
	},
	/**
	 * Rebuilds typed metadata from fetched key/value rows.
	 *
	 * @param rows Metadata rows joined from persistence.
	 * @returns Normalized metadata with empty-string defaults.
	 */
	deserialize(rows) {
		return {
			title: likeMetaValue(rows, "title") ?? "",
			url: likeMetaValue(rows, "url") ?? "",
		};
	},
};

/**
 * Repository for `like` posts backed by generic `Post` data helpers.
 *
 * This class centralizes type scoping, metadata encoding, and utilities
 * used by controllers/features that manage likes.
 */
export class LikePost {
	/**
	 * Post type discriminator used by all repository operations.
	 */
	static postType = "like" as const;

	/**
	 * Lists all `like` posts with decoded metadata.
	 *
	 * @param db Database connection used for the query.
	 * @returns All posts of type `like` ordered by the base repository.
	 */
	static findAll(db: Database) {
		return Post.findAllForType<"like", LikePost.Meta>(db, this.postType, likeMetaCodec);
	}

	/**
	 * Counts all persisted `like` posts.
	 *
	 * @param db Database connection used for counting.
	 * @returns Total number of rows for post type `like`.
	 */
	static count(db: Database) {
		return Post.countForType(db, this.postType);
	}

	/**
	 * Finds one `like` post by identifier.
	 *
	 * @param db Database connection used for the lookup.
	 * @param id Post identifier.
	 * @returns The matching post with decoded metadata, if found.
	 */
	static findById(db: Database, id: string) {
		return Post.findByIdForType<"like", LikePost.Meta>(db, this.postType, id, likeMetaCodec);
	}

	/**
	 * Creates a new `like` post and stores its metadata.
	 *
	 * @param db Database connection used for insertion.
	 * @param input Typed create payload for the `like` post.
	 * @returns The created post record as returned by the base repository.
	 */
	static create(db: Database, input: LikePost.CreateInput) {
		return Post.createForType<"like", LikePost.Meta>(db, this.postType, input, likeMetaCodec);
	}

	/**
	 * Updates an existing `like` post and its metadata values.
	 *
	 * @param db Database connection used for update queries.
	 * @param id Identifier of the post to update.
	 * @param input Partial typed update payload.
	 * @returns The updated post record, if the id exists.
	 */
	static update(db: Database, id: string, input: LikePost.UpdateInput) {
		return Post.updateForType<"like", LikePost.Meta>(db, this.postType, id, input, likeMetaCodec);
	}

	/**
	 * Deletes a post record by id.
	 *
	 * @param db Database connection used for deletion.
	 * @param id Identifier of the post to delete.
	 * @returns Result from the base `Post.destroy` operation.
	 */
	static destroy(db: Database, id: string) {
		return Post.destroy(db, id);
	}

	/**
	 * Normalizes user input into an acceptable like URL.
	 *
	 * Absolute HTTP(S) and site-relative paths are returned unchanged;
	 * bare domains/hosts are coerced to `https://`.
	 *
	 * @param url Raw URL input from forms or scripts.
	 * @returns Normalized URL string suitable for storage/display.
	 */
	static normalizeUrl(url: string) {
		if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
			return url;
		}

		return `https://${url}`;
	}

	/**
	 * Builds a Wayback Machine snapshot URL from creation time.
	 *
	 * Uses the post `created_at` timestamp to construct the archive capture
	 * key. Returns `null` when `created_at` cannot be parsed as a date.
	 *
	 * @param url Original target URL to archive.
	 * @param created_at Post creation timestamp.
	 * @returns Snapshot URL for `web.archive.org`, or `null` if invalid date.
	 */
	static waybackSnapshotUrl(url: string, created_at: string) {
		let created = new Date(created_at);
		if (Number.isNaN(created.getTime())) return null;

		let date = created
			.toISOString()
			.replaceAll("-", "")
			.replaceAll(":", "")
			.replaceAll(".", "")
			.replace("T", "");

		return `https://web.archive.org/web/${date}/${url}`;
	}
}
