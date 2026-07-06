/**
 * Subject model for the auth app. Provides data-access helpers for user
 * accounts, including lookup by email or id, paginated listing, counting, and
 * create/update/delete operations, serving as the persistence layer for users
 * across the login flows and admin user-management screens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { count, eq } from "drizzle-orm";

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

	static findAll(db: Database, options: { limit: number; offset: number }) {
		return db.query.subjects.findMany({
			limit: options.limit,
			offset: options.offset,
			orderBy(fields, operators) {
				return operators.asc(fields.createdAt);
			},
		});
	}

	static async count(db: Database) {
		let [result] = await db.select({ count: count() }).from(schema.subjects);
		return result?.count ?? 0;
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
			emailVerifiedAt?: Date | null;
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

	static async delete(db: Database, id: string) {
		return db.delete(schema.subjects).where(eq(schema.subjects.id, id));
	}
}
