import type { Database } from "~/db/index";

import * as schema from "~/db/schema";

export default class Credential {
	static find(db: Database, subjectId: string) {
		return db.query.credentials.findFirst({
			where(fields, operators) {
				return operators.eq(fields.subjectId, subjectId);
			},
		});
	}

	static create(db: Database, subjectId: string, passwordHash: string) {
		let credential = db.insert(schema.credentials).values({ subjectId, passwordHash }).returning();

		if (credential) return credential;
		throw new Error(`Failed to create credential for ${subjectId}`);
	}
}
