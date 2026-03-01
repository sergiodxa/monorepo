import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Grant {
	static table = createTable({
		name: "grants",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			subjectId: s.string(),
			clientId: s.string(),
			scopes: s.nullable(s.string()),
			createdAt: s.string(),
			updatedAt: s.string(),
		},
	});

	static list(db: Database) {
		return db.findMany(Grant.table);
	}

	static listBySubject(db: Database, subjectId: string) {
		return db.findMany(Grant.table, { where: { subjectId } });
	}

	static show(db: Database, id: string) {
		return db.findOne(Grant.table, { where: { id } });
	}

	static async findOrCreate(db: Database, subjectId: string, clientId: string) {
		let existing = await db.findOne(Grant.table, {
			where: { subjectId, clientId },
		});

		if (existing) return existing;

		return await db.create(Grant.table, {
			id: crypto.randomUUID(),
			subjectId,
			clientId,
			scopes: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
	}

	static async destroy(db: Database, id: string) {
		let grant = await db.findOne(Grant.table, { where: { id } });
		if (!grant) throw new RecordNotFoundError(Grant.table, { id });
		return await db.delete(Grant.table, { id });
	}
}
