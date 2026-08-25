/**
 * Repository for `post_meta` rows — the EAV key/value store holding every
 * type-specific field of a post. Kept minimal; the {@link Post} model orchestrates
 * the writes and typed decoding on top of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import { postMeta } from "../../database/schema";

/** Fields accepted when creating a metadata row; `id`, `created_at`, and `updated_at` default when omitted. */
export interface CreatePostMetaInput {
	id?: string;
	post_id: string;
	key: string;
	value: string;
	created_at?: string;
	updated_at?: string;
}

/** CRUD access to `post_meta` rows, returning values in their raw stored string form. */
export class PostMeta {
	/** Table reference shared by all queries. */
	static table = postMeta;

	/**
	 * Finds a metadata row by id.
	 * @param db - Database handle.
	 * @param id - The metadata row id.
	 * @returns The row, or `null` when not found.
	 */
	static findById(db: Database, id: string) {
		return db.findOne(this.table, { where: { id } });
	}

	/**
	 * Lists all metadata rows for one post.
	 * @param db - Database handle.
	 * @param post_id - The owning post id.
	 * @returns All metadata rows for the post.
	 */
	static findByPostId(db: Database, post_id: string) {
		return db.findMany(this.table, { where: { post_id } });
	}

	/**
	 * Creates a metadata row and reads it back.
	 * @param db - Database handle (or transaction).
	 * @param input - The row to create (id defaults to a random UUID).
	 * @returns The created row, or `null` if the read-back fails.
	 */
	static async create(db: Database, input: CreatePostMetaInput) {
		let now = new Date().toISOString();
		let id = input.id ?? crypto.randomUUID();
		await db.create(this.table, {
			id,
			post_id: input.post_id,
			key: input.key,
			value: input.value,
			created_at: input.created_at ?? now,
			updated_at: input.updated_at ?? now,
		});
		return this.findById(db, id);
	}
}
