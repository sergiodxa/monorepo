import type { Database } from "remix/data-table";

import * as schema from "~/schema";

export namespace PostMeta {
	/**
	 * Payload used to create a metadata entry for a post.
	 * Includes the target post and the key/value pair to persist.
	 *
	 * @example
	 * let input: PostMeta.CreateInput = {
	 * 	postId: "post_1",
	 * 	key: "slug",
	 * 	value: "hello-world",
	 * };
	 */
	export interface CreateInput {
		id?: string;
		post_id: string;
		key: string;
		value: string;
		created_at?: string;
		updated_at?: string;
	}

	/**
	 * Payload used to update an existing metadata entry.
	 * Any provided field replaces the current stored value.
	 *
	 * @example
	 * let input: PostMeta.UpdateInput = { value: "updated-slug" };
	 */
	export interface UpdateInput {
		key?: string;
		value?: string;
		updated_at?: string;
	}
}

export class PostMeta {
	static table = schema.postMeta;

	/**
	 * Fetches every metadata entry in storage.
	 * Use this when you need a complete metadata list.
	 *
	 * @param db Database client used to run operations.
	 * @returns All stored metadata entries.
	 * @example
	 * let rows = await PostMeta.findAll(db);
	 */
	static findAll(db: Database) {
		return db.findMany(this.table);
	}

	/**
	 * Finds one metadata entry by its unique identifier.
	 * Returns null when no matching row exists.
	 *
	 * @param db Database client used to run operations.
	 * @param id Identifier of the metadata entry to retrieve.
	 * @returns The matching metadata entry, or null when missing.
	 * @example
	 * let meta = await PostMeta.findById(db, "meta_1");
	 */
	static findById(db: Database, id: string) {
		return db.findOne(this.table, { where: { id } });
	}

	/**
	 * Fetches all metadata entries that belong to a post.
	 * Useful for rebuilding a post's metadata object.
	 *
	 * @param db Database client used to run operations.
	 * @param postId Identifier of the post that owns the metadata.
	 * @returns Metadata entries linked to the post.
	 * @example
	 * let meta = await PostMeta.findByPostId(db, "post_1");
	 */
	static findByPostId(db: Database, post_id: string) {
		return db.findMany(this.table, { where: { post_id } });
	}

	/**
	 * Fetches all metadata entries that share the same key.
	 * Use it to search metadata across many posts.
	 *
	 * @param db Database client used to run operations.
	 * @param key Metadata key to match.
	 * @returns Metadata entries with the requested key.
	 * @example
	 * let slugs = await PostMeta.findByKey(db, "slug");
	 */
	static findByKey(db: Database, key: string) {
		return db.findMany(this.table, { where: { key } });
	}

	/**
	 * Fetches metadata entries by an exact key/value pair.
	 * Useful for lookups like slug to post resolution.
	 *
	 * @param db Database client used to run operations.
	 * @param key Metadata key to match.
	 * @param value Metadata value to match.
	 * @returns Metadata entries matching both key and value.
	 * @example
	 * let matches = await PostMeta.findByKeyValue(db, "slug", "hello-world");
	 */
	static findByKeyValue(db: Database, key: string, value: string) {
		return db.findMany(this.table, { where: { key, value } });
	}

	/**
	 * Creates a new metadata entry for a post.
	 * Generates defaults for missing id and timestamps.
	 *
	 * @param db Database client used to run operations.
	 * @param input Metadata values to persist.
	 * @returns The newly created metadata entry.
	 * @example
	 * let created = await PostMeta.create(db, {
	 * 	postId: "post_1",
	 * 	key: "title",
	 * 	value: "Hello World",
	 * });
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

	/**
	 * Creates or updates a metadata entry for a post key.
	 * If the key exists, only the value is replaced.
	 *
	 * @param db Database client used to run operations.
	 * @param postId Identifier of the target post.
	 * @param key Metadata key to upsert.
	 * @param value Metadata value to store.
	 * @returns The created or updated metadata entry.
	 * @example
	 * let meta = await PostMeta.upsert(db, "post_1", "slug", "hello-world");
	 */
	static async upsert(db: Database, post_id: string, key: string, value: string) {
		let existing = await db.findOne(this.table, { where: { post_id, key } });

		if (!existing) return this.create(db, { post_id, key, value });

		await db.update(this.table, { id: existing.id }, { value, updated_at: this.timestamp });

		return this.findById(db, existing.id);
	}

	/**
	 * Updates an existing metadata entry by id.
	 * Returns null when the entry does not exist.
	 *
	 * @param db Database client used to run operations.
	 * @param id Identifier of the metadata entry to update.
	 * @param input New metadata values to apply.
	 * @returns The updated metadata entry, or null when missing.
	 * @example
	 * let updated = await PostMeta.update(db, "meta_1", { value: "new-value" });
	 */
	static async update(db: Database, id: string, input: PostMeta.UpdateInput) {
		let record = await this.findById(db, id);
		if (!record) return null;

		await db.update(
			this.table,
			{ id },
			{
				key: input.key ?? record.key,
				value: input.value ?? record.value,
				updated_at: input.updated_at ?? this.timestamp,
			},
		);

		return this.findById(db, id);
	}

	/**
	 * Deletes a metadata entry by id.
	 *
	 * @param db Database client used to run operations.
	 * @param id Identifier of the metadata entry to delete.
	 * @returns Deletion result from the data layer.
	 * @example
	 * await PostMeta.destroy(db, "meta_1");
	 */
	static destroy(db: Database, id: string) {
		return db.delete(this.table, { id });
	}

	/**
	 * Deletes all metadata entries linked to a post.
	 *
	 * @param db Database client used to run operations.
	 * @param postId Identifier of the post whose metadata will be removed.
	 * @returns Number of metadata entries that were deleted.
	 * @example
	 * let removed = await PostMeta.destroyByPostId(db, "post_1");
	 */
	static async destroyByPostId(db: Database, post_id: string) {
		let rows = await this.findByPostId(db, post_id);
		await db.deleteMany(this.table, { where: { post_id } });

		return rows.length;
	}

	private static get timestamp() {
		return new Date().toISOString();
	}
}
