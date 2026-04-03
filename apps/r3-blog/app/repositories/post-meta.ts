import type { Database } from "remix/data-table";

import * as schema from "~/database/schema";

export namespace PostMeta {
	export interface CreateInput {
		id?: string;
		post_id: string;
		key: string;
		value: string;
		created_at?: string;
		updated_at?: string;
	}
}

export class PostMeta {
	static table = schema.postMeta;

	static findById(db: Database, id: string) {
		return db.findOne(this.table, { where: { id } });
	}

	static findByPostId(db: Database, post_id: string) {
		return db.findMany(this.table, { where: { post_id } });
	}

	/** Batch lookup to avoid N+1 metadata queries. */
	static async findByPostIds(db: Database, post_ids: Array<string>) {
		if (post_ids.length === 0) return Promise.resolve([] as Array<schema.SelectPostMeta>);
		let results = await Promise.all(post_ids.map((post_id) => this.findByPostId(db, post_id)));
		return results.flat();
	}

	static findByKeyValue(db: Database, key: string, value: string) {
		return db.findMany(this.table, { where: { key, value } });
	}

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
