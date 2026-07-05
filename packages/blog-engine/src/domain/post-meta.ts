import type { Database } from "remix/data-table";

import { postMeta } from "../database/schema";

/** Input for creating a metadata row attached to a post. */
export interface CreatePostMetaInput {
	id?: string;
	post_id: string;
	key: string;
	value: string;
	created_at?: string;
	updated_at?: string;
}

/** Repository for `post_meta` rows (EAV metadata for posts). */
export class PostMeta {
	/** Table reference shared by all queries. */
	static table = postMeta;

	/** Finds a metadata row by id. */
	static findById(db: Database, id: string) {
		return db.findOne(this.table, { where: { id } });
	}

	/** Lists all metadata rows for one post. */
	static findByPostId(db: Database, post_id: string) {
		return db.findMany(this.table, { where: { post_id } });
	}

	/** Creates a metadata row and reads it back. */
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
