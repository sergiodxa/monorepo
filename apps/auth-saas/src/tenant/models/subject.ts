import type { Database } from "remix/data-table";

import { unwrap } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Subject {
	static UnverifiedEmailError = class extends Error {
		override name = "UnverifiedEmailError";
	};

	static table = createTable({
		name: "subjects",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			email: s.string(),
			email_verified_at: s.nullable(s.string()),
			display_name: s.nullable(s.string()),
			username: s.string(),
			avatar_url: s.nullable(s.string()),
			role: s.defaulted(s.enum_(["admin", "user"]), "user"),
			created_at: s.string(),
			updated_at: s.string(),
		},
	});

	static list(db: Database) {
		return db.findMany(Subject.table);
	}

	static show(db: Database, id: string) {
		return db.findOne(Subject.table, { where: { id } });
	}

	static findByEmail(db: Database, email: string) {
		return db.findOne(Subject.table, { where: { email } });
	}

	static async register(db: Database, data: { email: string; username: string }) {
		let result = await unwrap(validate(data, Subject.table));

		let id = crypto.randomUUID();
		await db.create(Subject.table, {
			id,
			email: result.email,
			email_verified_at: null,
			display_name: null,
			username: result.username,
			avatar_url: null,
			role: "user",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});

		let subject = await db.findOne(Subject.table, { where: { id } });
		if (!subject) throw new Error("Failed to create subject");
		return subject;
	}

	static async verifyEmail(db: Database, id: string) {
		let subject = await db.findOne(Subject.table, { where: { id } });
		if (!subject) throw new RecordNotFoundError(Subject.table, { id });

		return await db.update(
			Subject.table,
			{ id },
			{
				email_verified_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			},
		);
	}

	static async update(
		db: Database,
		id: string,
		data: { displayName?: string; avatarUrl?: string },
	) {
		let subject = await db.findOne(Subject.table, { where: { id } });
		if (!subject) throw new RecordNotFoundError(Subject.table, { id });

		return await db.update(
			Subject.table,
			{ id },
			{
				display_name: data.displayName ?? subject.display_name,
				avatar_url: data.avatarUrl ?? subject.avatar_url,
				updated_at: new Date().toISOString(),
			},
		);
	}

	static async destroy(db: Database, id: string) {
		let subject = await db.findOne(Subject.table, { where: { id } });
		if (!subject) throw new RecordNotFoundError(Subject.table, { id });
		return await db.delete(Subject.table, { id });
	}

	static async cleanupUnverified(db: Database, olderThan: number) {
		let cutoffDate = new Date(Date.now() - olderThan).toISOString();
		let unverifiedSubjects = await db.findMany(Subject.table, {
			where: { email_verified_at: null },
		});

		let toDelete = unverifiedSubjects.filter((subject) => subject.created_at < cutoffDate);

		if (toDelete.length === 0) return 0;

		// Delete in parallel for better performance
		await Promise.all(toDelete.map((subject) => db.delete(Subject.table, { id: subject.id })));

		return toDelete.length;
	}
}
