import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Grant {
	static table = table({
		name: "grants",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			subject_id: c.text(),
			client_id: c.text(),
			scopes: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	static list(db: Database) {
		return db.findMany(Grant.table);
	}

	static listBySubject(db: Database, subjectId: string) {
		return db.findMany(Grant.table, { where: { subject_id: subjectId } });
	}

	static show(db: Database, id: string) {
		return db.findOne(Grant.table, { where: { id } });
	}

	static async findOrCreate(db: Database, subjectId: string, clientId: string) {
		let existing = await db.findOne(Grant.table, {
			where: { subject_id: subjectId, client_id: clientId },
		});

		if (existing) return existing;

		let id = crypto.randomUUID();
		await db.create(Grant.table, {
			id,
			subject_id: subjectId,
			client_id: clientId,
			scopes: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});

		return (await db.findOne(Grant.table, { where: { id } }))!;
	}

	static async destroy(db: Database, id: string) {
		let grant = await db.findOne(Grant.table, { where: { id } });
		if (!grant) throw new RecordNotFoundError(Grant.table, { id });
		return await db.delete(Grant.table, { id });
	}
}
