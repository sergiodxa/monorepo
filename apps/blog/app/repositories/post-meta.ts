/**
 * PostMeta repository for blog. Provides read/create access to the key-value
 * `post_meta` rows attached to posts, with lookups by id, post, and key/value,
 * plus a create helper that fills generated ids and ISO timestamps on insert.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import * as schema from "~/database/schema";

/**
 * Type contracts for post metadata persistence operations.
 */
export namespace PostMeta {
	/**
	 * Input contract for creating a metadata row attached to a post.
	 * Optional fields allow deterministic ids/timestamps in imports and tests.
	 */
	export interface CreateInput {
		/** Generated automatically when omitted. */
		id?: string;
		post_id: string;
		key: string;
		value: string;
		/** Creation timestamp override in ISO-8601 format. */
		created_at?: string;
		/** Last update timestamp override in ISO-8601 format. */
		updated_at?: string;
	}
}

/**
 * Repository for querying and creating rows in the post metadata table.
 * Methods keep DB field names in snake_case to match schema columns.
 */
export class PostMeta {
	static table = schema.postMeta;

	/**
	 * Finds a single metadata row by primary id.
	 * @param db Database client used for the query.
	 * @param id Metadata row id.
	 * @returns Matching row, or null when the id does not exist.
	 */
	static findById(db: Database, id: string) {
		return db.findOne(this.table, { where: { id } });
	}

	/**
	 * Lists all metadata rows that belong to one post.
	 * @param db Database client used for the query.
	 * @param post_id Parent post id.
	 * @returns All metadata rows for the post, in database order.
	 */
	static findByPostId(db: Database, post_id: string) {
		return db.findMany(this.table, { where: { post_id } });
	}

	/**
	 * Finds metadata rows that match an exact key/value pair.
	 * @param db Database client used for the query.
	 * @param key Metadata key to match.
	 * @param value Metadata value to match.
	 * @returns All rows where both `key` and `value` match exactly.
	 */
	static findByKeyValue(db: Database, key: string, value: string) {
		return db.findMany(this.table, { where: { key, value } });
	}

	/**
	 * Creates a metadata row and loads the persisted record by id.
	 * Missing `id` and timestamps are filled with generated defaults.
	 * @param db Database client used for create and read-back.
	 * @param input Metadata payload to persist.
	 * @returns Newly stored row, or null if the read-after-write lookup fails.
	 */
	static async create(db: Database, input: PostMeta.CreateInput) {
		let now = this.timestamp;
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

	private static get timestamp() {
		return new Date().toISOString();
	}
}
