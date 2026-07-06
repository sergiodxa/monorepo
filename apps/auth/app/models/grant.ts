/**
 * Grant model for the auth app. Manages consent grants that record which
 * clients a subject has authorized, offering find-or-create, per-subject
 * listing with client details, counting by client, and deletion by subject,
 * client, or both — the persistence layer behind OAuth consent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { and, count, eq } from "drizzle-orm";

import type { Database } from "~/db/index";

import * as schema from "~/db/schema";

export default class Grant {
	static async findOrCreate(db: Database, subjectId: string, clientId: string) {
		let existing = await db.query.grants.findFirst({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.subjectId, subjectId),
					operators.eq(fields.clientId, clientId),
				);
			},
		});

		if (existing) return existing;

		let [grant] = await db.insert(schema.grants).values({ subjectId, clientId }).returning();

		if (grant) return grant;
		throw new Error(`Failed to create grant for ${subjectId} on ${clientId}`);
	}

	static async findBySubjectId(db: Database, subjectId: string) {
		return db.query.grants.findMany({
			where(fields, operators) {
				return operators.eq(fields.subjectId, subjectId);
			},
			with: { client: true },
			orderBy(fields, operators) {
				return operators.asc(fields.createdAt);
			},
		});
	}

	static async countByClientId(db: Database, clientId: string) {
		let [result] = await db
			.select({ count: count() })
			.from(schema.grants)
			.where(eq(schema.grants.clientId, clientId));
		return result?.count ?? 0;
	}

	static async deleteBySubjectId(db: Database, subjectId: string) {
		return db.delete(schema.grants).where(eq(schema.grants.subjectId, subjectId));
	}

	static async deleteByClientId(db: Database, clientId: string) {
		return db.delete(schema.grants).where(eq(schema.grants.clientId, clientId));
	}

	static async deleteBySubjectAndClient(db: Database, subjectId: string, clientId: string) {
		return db
			.delete(schema.grants)
			.where(and(eq(schema.grants.subjectId, subjectId), eq(schema.grants.clientId, clientId)));
	}
}
