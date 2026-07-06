/**
 * Credential model for the auth app. Provides data-access helpers to look up a
 * subject's password credential and to create a new one from a password hash,
 * encapsulating the credentials-table queries used by the password login flow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
