import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Session {
	static table = createTable({
		name: "sessions",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			subjectId: s.string(),
			clientId: s.string(),
			ip: s.nullable(s.string()),
			userAgent: s.nullable(s.string()),
			expiresAt: s.string(),
			createdAt: s.string(),
			updatedAt: s.string(),
		},
	});

	static list(db: Database) {
		return db.findMany(Session.table);
	}

	static show(db: Database, id: string) {
		return db.findOne(Session.table, { where: { id } });
	}

	static async create(
		db: Database,
		data: {
			subjectId: string;
			clientId: string;
			ip?: string | null;
			userAgent?: string | null;
		},
	) {
		let now = new Date();
		let expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

		return await db.create(Session.table, {
			id: crypto.randomUUID(),
			subjectId: data.subjectId,
			clientId: data.clientId,
			ip: data.ip ?? null,
			userAgent: data.userAgent ?? null,
			expiresAt: expiresAt.toISOString(),
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
		});
	}

	static async touch(db: Database, id: string) {
		let session = await db.findOne(Session.table, { where: { id } });
		if (!session) throw new RecordNotFoundError(Session.table, { id });

		return await db.update(
			Session.table,
			{ id },
			{
				updatedAt: new Date().toISOString(),
			},
		);
	}

	static async destroy(db: Database, id: string) {
		let session = await db.findOne(Session.table, { where: { id } });
		if (!session) throw new RecordNotFoundError(Session.table, { id });
		return await db.delete(Session.table, { id });
	}

	static async destroyBySubject(db: Database, subjectId: string) {
		let sessions = await db.findMany(Session.table, { where: { subjectId } });

		for (let session of sessions) {
			await db.delete(Session.table, { id: session.id });
		}

		return sessions.length;
	}

	static async cleanupExpired(db: Database, now: number) {
		let cutoffDate = new Date(now).toISOString();
		let sessions = await db.findMany(Session.table);

		let expiredSessions = sessions.filter((session) => session.expiresAt < cutoffDate);

		for (let session of expiredSessions) await db.delete(Session.table, { id: session.id });

		return expiredSessions.length;
	}
}

namespace Session {}
