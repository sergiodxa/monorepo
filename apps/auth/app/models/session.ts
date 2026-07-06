/**
 * Session model for the auth app. Encapsulates refresh-token sessions, with
 * helpers to create, look up, list per subject, touch, and revoke sessions
 * (by id, subject, or subject+client), plus finding and purging expired ones
 * and counting active sessions — the store backing tokens and device listings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { and, count, eq, gt } from "drizzle-orm";

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

	static async findBySubjectId(db: Database, subjectId: string) {
		return db.query.sessions.findMany({
			where(fields, operators) {
				return operators.eq(fields.subjectId, subjectId);
			},
			with: { client: true },
			orderBy(fields, operators) {
				return operators.desc(fields.updatedAt);
			},
		});
	}

	static async deleteById(db: Database, id: string) {
		return db.delete(schema.sessions).where(eq(schema.sessions.id, id));
	}

	static async touch(db: Database, id: string) {
		return db
			.update(schema.sessions)
			.set({ updatedAt: new Date() })
			.where(eq(schema.sessions.id, id));
	}

	static async deleteBySubjectId(db: Database, subjectId: string) {
		return db.delete(schema.sessions).where(eq(schema.sessions.subjectId, subjectId));
	}

	static async deleteBySubjectAndClient(db: Database, subjectId: string, clientId: string) {
		return db
			.delete(schema.sessions)
			.where(and(eq(schema.sessions.subjectId, subjectId), eq(schema.sessions.clientId, clientId)));
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

	static async countActive(db: Database) {
		let [result] = await db
			.select({ count: count() })
			.from(schema.sessions)
			.where(gt(schema.sessions.expiresAt, new Date()));
		return result?.count ?? 0;
	}
}
