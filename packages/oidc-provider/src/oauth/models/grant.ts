/**
 * Model for OAuth consent grants linking a subject to a client.
 *
 * A grant records that a user has authorized a given client, so subsequent
 * authorization requests can skip the consent step. Provides lookup, find-or-create,
 * and revocation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "../../shared/lib/db-errors";

export default class Grant {
	static table = table({
		name: "grants",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			subject_id: c.text(),
			client_id: c.text(),
			scopes: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Lists all grants.
	 * @param db - Database instance.
	 * @returns Array of all grant records.
	 */
	static list(db: Database) {
		return db.findMany(Grant.table);
	}

	/**
	 * Lists all grants belonging to a specific subject.
	 * @param db - Database instance.
	 * @param subjectId - Subject ID to filter by.
	 * @returns Array of grant records for the subject.
	 */
	static listBySubject(db: Database, subjectId: string) {
		return db.findMany(Grant.table, { where: { subject_id: subjectId } });
	}

	/**
	 * Retrieves a single grant by ID.
	 * @param db - Database instance.
	 * @param id - Grant ID.
	 * @returns Grant record or null if not found.
	 */
	static show(db: Database, id: string) {
		return db.findOne(Grant.table, { where: { id } });
	}

	/**
	 * Returns the existing grant for a subject/client pair, creating one if absent.
	 * @param db - Database instance.
	 * @param subjectId - Subject that authorized the client.
	 * @param clientId - Client the grant is for.
	 * @returns The existing or newly created grant record.
	 * @example
	 * let grant = await Grant.findOrCreate(db, subject.id, client.id);
	 */
	static async findOrCreate(db: Database, subjectId: string, clientId: string) {
		let existing = await db.findOne(Grant.table, {
			where: { subject_id: subjectId, client_id: clientId },
		});

		if (existing) return existing;

		let id = crypto.randomUUID();
		await db.create(Grant.table, {
			id,
			subject_id: subjectId,
			client_id: clientId,
			scopes: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});

		return (await db.findOne(Grant.table, { where: { id } }))!;
	}

	/**
	 * Deletes (revokes) a grant.
	 * @param db - Database instance.
	 * @param id - Grant ID.
	 * @returns Deletion result.
	 * @throws {RecordNotFoundError} If the grant does not exist.
	 */
	static async destroy(db: Database, id: string) {
		let grant = await db.findOne(Grant.table, { where: { id } });
		if (!grant) throw new RecordNotFoundError(Grant.table, { id });
		return await db.delete(Grant.table, { id });
	}
}
