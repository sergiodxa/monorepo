import { eq } from "drizzle-orm";

import type { Database } from "~/db/index";

import * as schema from "~/db/schema";

export default class Subject {
	static findByEmail(db: Database, emailAddress: string) {
		return db.query.subjects.findFirst({
			where(fields, operators) {
				return operators.eq(fields.emailAddress, emailAddress);
			},
		});
	}

	static findById(db: Database, id: string) {
		return db.query.subjects.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, id);
			},
		});
	}

	static async create(
		db: Database,
		input: {
			id?: string;
			emailAddress: string;
			displayName: string;
			username: string;
			avatar: string;
		},
	) {
		let [subject] = await db.insert(schema.subjects).values(input).returning();

		if (subject) return subject;
		throw new Error(`Failed to create subject for ${input.emailAddress}`);
	}

	static async update(db: Database, id: string, input: Partial<schema.InsertSubject>) {
		let [subject] = await db
			.update(schema.subjects)
			.set(input)
			.where(eq(schema.subjects.id, id))
			.returning();

		if (subject) return subject;
		throw new Error(`Failed to update subject with id ${id}`);
	}
}
