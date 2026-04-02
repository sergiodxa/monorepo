import type { Database } from "remix/data-table";

import * as schema from "~/schema";

export namespace PostMeta {
	export interface CreateInput {
		id?: string;
		post_id: string;
		key: string;
		value: string;
		created_at?: string;
		updated_at?: string;
	}

	export interface UpdateInput {
		key?: string;
		value?: string;
		updated_at?: string;
	}
}

export class PostMeta {
	static table = schema.postMeta;

	static findAll(db: Database) {
		return db.findMany(this.table);
	}

	static findById(db: Database, id: string) {
		return db.findOne(this.table, { where: { id } });
	}

	static findByPostId(db: Database, post_id: string) {
		return db.findMany(this.table, { where: { post_id } });
	}

	/** Batch lookup to avoid N+1 metadata queries. */
	static findByPostIds(db: Database, post_ids: Array<string>) {
		if (post_ids.length === 0) return Promise.resolve([] as Array<schema.SelectPostMeta>);

		return Promise.all(post_ids.map((post_id) => this.findByPostId(db, post_id))).then((results) =>
			results.flat(),
		);
	}

	static findByKey(db: Database, key: string) {
		return db.findMany(this.table, { where: { key } });
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

	/** Upsert by `{ post_id, key }`. */
	static async upsert(db: Database, post_id: string, key: string, value: string) {
		let existing = await db.findOne(this.table, { where: { post_id, key } });

		if (!existing) return this.create(db, { post_id, key, value });

		await db.update(this.table, existing.id, { value, updated_at: this.timestamp });

		return this.findById(db, existing.id);
	}

	static async update(db: Database, id: string, input: PostMeta.UpdateInput) {
		let record = await this.findById(db, id);
		if (!record) return null;

		await db.update(this.table, id, {
			key: input.key ?? record.key,
			value: input.value ?? record.value,
			updated_at: input.updated_at ?? this.timestamp,
		});

		return this.findById(db, id);
	}

	static destroy(db: Database, id: string) {
		return db.delete(this.table, id);
	}

	/** Returns how many rows were removed. */
	static async destroyByPostId(db: Database, post_id: string) {
		let rows = await this.findByPostId(db, post_id);
		await db.deleteMany(this.table, { where: { post_id } });

		return rows.length;
	}

	private static get timestamp() {
		return new Date().toISOString();
	}
}
