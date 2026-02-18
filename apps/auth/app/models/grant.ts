import { count, eq } from "drizzle-orm";

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
}
