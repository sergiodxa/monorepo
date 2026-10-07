/**
 * Like posts (liked links and bookmarks): the shared `Post` model scoped to the
 * `like` type, with its metadata codec, the URL cleaning and address that decide
 * when two bookmarks are one, and the Wayback Machine snapshot link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Bookmark } from "~/app/repositories/bookmark";
import { Post } from "~/app/repositories/post";

/**
 * Query parameters that only say where a click came from, removed from a URL before it is
 * stored so two shares of one page are one bookmark.
 */
const TRACKING_PARAMETER = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i;

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
		/** Empty until one is typed or read from the page; {@link LikePost.label} covers it. */
		title: string;
		url: string;
		/** The page's own summary or its opening; empty until one is typed or read. */
		description: string;
		/** The Wayback Machine capture's instant (ISO 8601); empty until one is recorded. */
		archived_at: string;
	}

	/**
	 * Base post fields plus `Meta` values under `meta`, accepted by `create`; a bookmark
	 * created without a description or an archive starts with each empty.
	 */
	export interface CreateInput extends Omit<Post.TypedCreateInput<Meta>, "meta"> {
		meta: Omit<Meta, "description" | "archived_at"> &
			Partial<Pick<Meta, "description" | "archived_at">>;
	}

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
		if (typeof meta.description !== "undefined") {
			rows.push({ key: "description", value: meta.description });
		}
		if (typeof meta.archived_at !== "undefined") {
			rows.push({ key: "archived_at", value: meta.archived_at });
		}
		return rows;
	},
	deserialize(rows) {
		return {
			title: likeMetaValue(rows, "title") ?? "",
			url: likeMetaValue(rows, "url") ?? "",
			description: likeMetaValue(rows, "description") ?? "",
			archived_at: likeMetaValue(rows, "archived_at") ?? "",
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
		let meta = {
			...input.meta,
			description: input.meta.description ?? "",
			archived_at: input.meta.archived_at ?? "",
		};
		return Post.createForType<"like", LikePost.Meta>(
			db,
			this.postType,
			{ ...input, meta },
			likeMetaCodec,
		);
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
	 * Tombstones a bookmark and releases its address, so the same URL can be bookmarked again.
	 *
	 * @param db Database connection used for deletion.
	 * @param id Identifier of the post to delete.
	 * @returns `true` when a live bookmark was deleted.
	 */
	static async destroy(db: Database, id: string) {
		let destroyed = await Post.destroy(db, id);
		await Bookmark.remove(db, id);
		return destroyed;
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
	 * A URL as it is stored: bare hosts read as `https://`, tracking parameters removed, and an
	 * absolute URL in its canonical spelling. Site-relative paths and text that does not parse
	 * pass through, so the form still shows what was typed.
	 *
	 * @param input Raw URL from a form, a shared link or a script.
	 */
	static clean(input: string) {
		let normalized = this.normalizeUrl(input.trim());
		if (normalized.startsWith("/") || !URL.canParse(normalized)) return normalized;

		let url = new URL(normalized);
		for (let key of Array.from(url.searchParams.keys())) {
			if (TRACKING_PARAMETER.test(key)) url.searchParams.delete(key);
		}
		return url.href;
	}

	/**
	 * What two URLs must share to be the same bookmark: the URL without its scheme, its host
	 * lowercased and without `www.`, and one trailing `/` dropped; path, query and fragment
	 * keep their case. Migration `0009_Bookmarks.sql` computes the same string in SQL.
	 *
	 * @param url A stored or cleaned URL.
	 */
	static address(url: string) {
		let trimmed = url.trim();
		let rest = trimmed.replace(/^https?:\/\//i, "");
		let ends = ["/", "?", "#"].map((mark) => rest.indexOf(mark)).filter((index) => index >= 0);
		let end = Math.min(rest.length, ...ends);

		let host = rest.slice(0, end).replaceAll(/[A-Z]/g, (letter) => letter.toLowerCase());
		if (host.startsWith("www.")) host = host.slice(4);

		let address = `${host}${rest.slice(end)}`;
		return address.endsWith("/") ? address.slice(0, -1) : address;
	}

	/**
	 * The name a bookmark is listed under: its title, or its address without the scheme while
	 * it has none.
	 *
	 * @param meta The bookmark's title and URL.
	 */
	static label(meta: Pick<LikePost.Meta, "title" | "url">) {
		let title = meta.title.trim();
		if (title !== "") return title;
		return this.normalizeUrl(meta.url).replace(/^https?:\/\//i, "");
	}

	/**
	 * Builds a Wayback Machine snapshot URL for a moment: the recorded capture's instant when
	 * there is one, the bookmark's creation otherwise. The archive answers with the capture
	 * closest to that moment, so an exact capture instant opens exactly that capture.
	 *
	 * @param url Original target URL to archive.
	 * @param at The capture's or the bookmark's instant.
	 * @returns Snapshot URL for `web.archive.org`, or `null` if invalid date.
	 */
	static waybackSnapshotUrl(url: string, at: string) {
		let instant = new Date(at);
		if (Number.isNaN(instant.getTime())) return null;

		let timestamp = instant.toISOString().replaceAll(/\D/g, "").slice(0, 14);
		return `https://web.archive.org/web/${timestamp}/${url}`;
	}
}
