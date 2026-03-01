import type { Database, PrimaryKeyInput } from "remix/data-table";

import { unwrap } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Subject {
	static table = createTable({
		name: "subjects",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			email: s.string(),
			emailVerifiedAt: s.nullable(s.string()),
			displayName: s.nullable(s.string()),
			username: s.string(),
			avatarUrl: s.nullable(s.string()),
			role: s.defaulted(s.enum_(["admin", "user"]), "user"),
			createdAt: s.string(),
			updatedAt: s.string(),
		},
	});

	static list(db: Database) {
		return db.findMany(Subject.table);
	}

	static show(db: Database, id: PrimaryKeyInput<typeof Subject.table>) {
		return db.findOne(Subject.table, { where: { id } });
	}

	static async register(db: Database, data: { email: string; username: string }) {
		let result = await unwrap(validate(data, Subject.table));

		return await db.create(Subject.table, {
			id: crypto.randomUUID(),
			email: result.email,
			emailVerifiedAt: null,
			displayName: null,
			username: result.username,
			avatarUrl: null,
			role: "user",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
	}

	static async verifyEmail(db: Database, id: PrimaryKeyInput<typeof Subject.table>) {
		let subject = await db.findOne(Subject.table, { where: { id } });
		if (!subject) throw new RecordNotFoundError(Subject.table, id);

		return await db.update(Subject.table, id, {
			emailVerifiedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
	}

	static async update(
		db: Database,
		id: PrimaryKeyInput<typeof Subject.table>,
		data: { displayName?: string; avatarUrl?: string },
	) {
		let subject = await db.findOne(Subject.table, { where: { id } });
		if (!subject) throw new RecordNotFoundError(Subject.table, id);

		return await db.update(Subject.table, id, {
			displayName: data.displayName ?? subject.displayName,
			avatarUrl: data.avatarUrl ?? subject.avatarUrl,
			updatedAt: new Date().toISOString(),
		});
	}

	static async destroy(db: Database, id: PrimaryKeyInput<typeof Subject.table>) {
		let subject = await db.findOne(Subject.table, { where: { id } });
		if (!subject) throw new RecordNotFoundError(Subject.table, id);
		return await db.delete(Subject.table, id);
	}
}

namespace Subject {}
