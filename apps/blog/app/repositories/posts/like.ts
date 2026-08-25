/**
 * Like posts (liked links and bookmarks): the shared `Post` model scoped to the
 * `like` type, with a title/url metadata codec plus URL normalization and
 * Wayback Machine snapshot helpers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Post } from "~/app/repositories/post";

/**
 * Type contracts for the metadata persisted in `post_meta` and the payloads
 * accepted by create and update.
 */
export namespace LikePost {
	/**
	 * Metadata persisted for a like post. `url` holds either an absolute HTTP(S)
	 * URL or a site-relative path.
	 */
	export interface Meta {
		title: string;
		url: string;
	}

	/**
	 * Base post fields plus `Meta` values under `meta`, accepted by `create`.
	 */
	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	/**
	 * Partial post and metadata updates accepted by `update`.
	 */
	export interface UpdateInput extends Post.TypedUpdateInput<Meta> {}
}

/**
 * Resolves duplicate rows for a metadata key to the latest write, so the result
 * stays stable whatever order the database returns rows in.
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
 * Serialization emits only defined fields; deserialization resolves the latest
 * row per key and falls back to empty strings.
 */
let likeMetaCodec: Post.MetaCodec<LikePost.Meta> = {
	serialize(meta) {
		let rows: Array<{ key: string; value: string }> = [];
		if (typeof meta.title !== "undefined") rows.push({ key: "title", value: meta.title });
		if (typeof meta.url !== "undefined") rows.push({ key: "url", value: meta.url });
		return rows;
	},
	deserialize(rows) {
		return {
			title: likeMetaValue(rows, "title") ?? "",
			url: likeMetaValue(rows, "url") ?? "",
		};
	},
};

/**
 * Posts of type `like`: shared `Post` CRUD narrowed by post type, plus URL
 * helpers for the liked target.
 */
export class LikePost {
	/**
	 * Discriminator that must match the persisted `posts.type` value.
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
	 * Absolute HTTP(S) URLs and site-relative paths pass through unchanged; bare
	 * hosts are prefixed with `https://`.
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
	 * Builds a Wayback Machine snapshot URL, using `created_at` as the archive
	 * capture key.
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
