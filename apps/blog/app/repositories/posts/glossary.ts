/**
 * Glossary posts: the shared `Post` model scoped to the `glossary` type, with a
 * codec mapping typed metadata to and from `post_meta` rows and resolving the
 * latest value per key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Post } from "~/app/repositories/post";

/**
 * Type contracts keeping call sites aligned with the required glossary fields.
 */
export namespace GlossaryPost {
	/**
	 * Metadata persisted for glossary posts. The codec always materializes `slug`,
	 * `term`, and `definition`.
	 */
	export interface Meta {
		slug: string;
		term: string;
		title?: string;
		definition: string;
	}

	/**
	 * Base post fields plus the required glossary metadata, accepted by `create`.
	 */
	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	/**
	 * Update payload whose metadata fields are optional, so callers patch only the
	 * changed keys.
	 */
	export interface UpdateInput extends Post.TypedUpdateInput<Meta> {}
}

/**
 * Resolves repeated rows for a metadata key to the latest write, ordering by
 * `updated_at` then `created_at`.
 *
 * @param rows Post-meta rows attached to a post.
 * @param key Metadata key to extract.
 * @returns The latest value for `key`, or `undefined` when absent.
 */
function glossaryMetaValue(
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
 * Serialization omits `undefined` properties; deserialization defaults required
 * fields to empty strings so `GlossaryPost.Meta` stays total.
 */
let glossaryMetaCodec: Post.MetaCodec<GlossaryPost.Meta> = {
	serialize(meta) {
		let rows: Array<{ key: string; value: string }> = [];
		if (typeof meta.slug !== "undefined") rows.push({ key: "slug", value: meta.slug });
		if (typeof meta.term !== "undefined") rows.push({ key: "term", value: meta.term });
		if (typeof meta.title !== "undefined") rows.push({ key: "title", value: meta.title });
		if (typeof meta.definition !== "undefined")
			rows.push({ key: "definition", value: meta.definition });
		return rows;
	},
	deserialize(rows) {
		return {
			slug: glossaryMetaValue(rows, "slug") ?? "",
			term: glossaryMetaValue(rows, "term") ?? "",
			title: glossaryMetaValue(rows, "title"),
			definition: glossaryMetaValue(rows, "definition") ?? "",
		};
	},
};

/**
 * Posts of type `glossary`: every operation is scoped to that post type and
 * runs through the glossary metadata codec.
 */
export class GlossaryPost {
	/**
	 * Discriminator that must match the persisted `posts.type` value.
	 */
	static postType = "glossary" as const;

	/**
	 * Finds all glossary posts with decoded glossary metadata.
	 *
	 * @param db Database client used for reads.
	 * @returns All glossary posts currently stored.
	 */
	static findAll(db: Database) {
		return Post.findAllForType<"glossary", GlossaryPost.Meta>(db, this.postType, glossaryMetaCodec);
	}

	/**
	 * Counts persisted rows for the glossary post type.
	 *
	 * @param db Database client used for aggregation.
	 * @returns Total number of glossary posts.
	 */
	static count(db: Database) {
		return Post.countForType(db, this.postType);
	}

	/**
	 * Finds a glossary post by id and decodes its metadata.
	 *
	 * @param db Database client used for lookup.
	 * @param id Post identifier to load.
	 * @returns The matching glossary post, or `null` when not found/type-mismatched.
	 */
	static findById(db: Database, id: string) {
		return Post.findByIdForType<"glossary", GlossaryPost.Meta>(
			db,
			this.postType,
			id,
			glossaryMetaCodec,
		);
	}

	/**
	 * Creates a glossary post with metadata encoded into `post_meta` rows.
	 *
	 * @param db Database client used for writes.
	 * @param input New glossary post payload.
	 * @returns The created glossary post with decoded metadata.
	 */
	static create(db: Database, input: GlossaryPost.CreateInput) {
		return Post.createForType<"glossary", GlossaryPost.Meta>(
			db,
			this.postType,
			input,
			glossaryMetaCodec,
		);
	}

	/**
	 * Updates a glossary post and selectively patches metadata keys.
	 *
	 * @param db Database client used for writes.
	 * @param id Post identifier to update.
	 * @param input Partial glossary post payload.
	 * @returns The updated glossary post, or `null` when no row matches.
	 */
	static update(db: Database, id: string, input: GlossaryPost.UpdateInput) {
		return Post.updateForType<"glossary", GlossaryPost.Meta>(
			db,
			this.postType,
			id,
			input,
			glossaryMetaCodec,
		);
	}

	/**
	 * Deletes a glossary post row and its linked metadata.
	 *
	 * @param db Database client used for deletion.
	 * @param id Post identifier to remove.
	 * @returns Deletion result from the shared post repository.
	 */
	static destroy(db: Database, id: string) {
		return Post.destroy(db, id);
	}
}
