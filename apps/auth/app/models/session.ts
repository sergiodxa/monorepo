import { eq } from "drizzle-orm";

import type { Database } from "~/db/index";

import * as schema from "~/db/schema";

export default class Session {
	static async create(
		db: Database,
		subjectId: string,
		clientId: string,
		ip: string | null,
		ua: string | null,
	) {
		let [session] = await db
			.insert(schema.sessions)
			.values({ subjectId, clientId, ip, ua })
			.returning();

		if (session) return session;
		throw new Error(`Failed to create session for ${subjectId}`);
	}

	static async findById(db: Database, id: string) {
		return db.query.sessions.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, id);
			},
		});
	}

	static async deleteById(db: Database, id: string) {
		return db.delete(schema.sessions).where(eq(schema.sessions.id, id));
	}

	static async deleteBySubjectId(db: Database, subjectId: string) {
		return db.delete(schema.sessions).where(eq(schema.sessions.subjectId, subjectId));
	}

	static async findExpiredSessions(db: Database) {
		return db.query.sessions.findMany({
			where(fields, operators) {
				return operators.lte(fields.expiresAt, new Date());
			},
		});
	}

	static async deleteExpiredSessions(db: Database) {
		const expiredSessions = await Session.findExpiredSessions(db);
		if (expiredSessions.length === 0) return;

		return Promise.all(
			expiredSessions.map((session) =>
				db.delete(schema.sessions).where(eq(schema.sessions.id, session.id)),
			),
		);
	}
}
