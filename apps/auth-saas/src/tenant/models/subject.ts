import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

/**
 * Model for subjects (users).
 * Manages user registration, profile updates, and email verification.
 */
export default class Subject {
	/** Error thrown when an operation requires a verified email. */
	static UnverifiedEmailError = class extends Error {
		override name = "UnverifiedEmailError";
	};

	/** Database table schema for subjects. */
	static table = createTable({
		name: "subjects",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			email: s.string(),
			email_verified_at: s.nullable(s.string()),
			display_name: s.nullable(s.string()),
			username: s.string(),
			avatar_url: s.nullable(s.string()),
			role: s.defaulted(s.enum_(["admin", "user"]), "user"),
			created_at: s.string(),
			updated_at: s.string(),
		},
	});

	/**
	 * Lists all subjects.
	 * @param db - Database instance
	 * @returns Array of all subject records
	 */
	static list(db: Database) {
		return db.findMany(Subject.table);
	}

	/**
	 * Returns the count of all subjects.
	 * Currently loads all records due to ORM limitations.
	 * @param db - Database instance
	 * @returns Total number of subjects
	 */
	static async count(db: Database): Promise<number> {
		let subjects = await db.findMany(Subject.table);
		return subjects.length;
	}

	/**
	 * Retrieves a single subject by ID.
	 * @param db - Database instance
	 * @param id - Subject ID
	 * @returns Subject record or null if not found
	 */
	static show(db: Database, id: string) {
		return db.findOne(Subject.table, { where: { id } });
	}

	/**
	 * Finds a subject by email address.
	 * @param db - Database instance
	 * @param email - Email address
	 * @returns Subject record or null if not found
	 */
	static findByEmail(db: Database, email: string) {
		return db.findOne(Subject.table, { where: { email } });
	}

	/**
	 * Registers a new subject with unverified email.
	 * @param db - Database instance
	 * @param data - Registration data including email and username
	 * @returns Created subject record
	 */
	static async register(db: Database, data: { email: string; username: string }) {
		let id = crypto.randomUUID();
		await db.create(Subject.table, {
			id,
			email: data.email,
			email_verified_at: null,
			display_name: null,
			username: data.username,
			avatar_url: null,
			role: "user",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});

		let subject = await db.findOne(Subject.table, { where: { id } });
		if (!subject) throw new Error("Failed to create subject");
		return subject;
	}

	/**
	 * Marks a subject's email as verified.
	 * @param db - Database instance
	 * @param id - Subject ID
	 * @returns Updated subject record
	 * @throws {RecordNotFoundError} If subject does not exist
	 */
	static async verifyEmail(db: Database, id: string) {
		let subject = await db.findOne(Subject.table, { where: { id } });
		if (!subject) throw new RecordNotFoundError(Subject.table, { id });

		return await db.update(
			Subject.table,
			{ id },
			{
				email_verified_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			},
		);
	}

	/**
	 * Updates a subject's profile.
	 * @param db - Database instance
	 * @param id - Subject ID
	 * @param data - Profile properties to update
	 * @returns Updated subject record
	 * @throws {RecordNotFoundError} If subject does not exist
	 */
	static async update(
		db: Database,
		id: string,
		data: { displayName?: string; avatarUrl?: string },
	) {
		let subject = await db.findOne(Subject.table, { where: { id } });
		if (!subject) throw new RecordNotFoundError(Subject.table, { id });

		return await db.update(
			Subject.table,
			{ id },
			{
				display_name: data.displayName ?? subject.display_name,
				avatar_url: data.avatarUrl ?? subject.avatar_url,
				updated_at: new Date().toISOString(),
			},
		);
	}

	/**
	 * Deletes a subject.
	 * @param db - Database instance
	 * @param id - Subject ID
	 * @returns Deletion result
	 * @throws {RecordNotFoundError} If subject does not exist
	 */
	static async destroy(db: Database, id: string) {
		let subject = await db.findOne(Subject.table, { where: { id } });
		if (!subject) throw new RecordNotFoundError(Subject.table, { id });
		return await db.delete(Subject.table, { id });
	}

	/**
	 * Removes subjects with unverified emails older than the specified duration.
	 * @param db - Database instance
	 * @param olderThan - Age threshold in milliseconds
	 * @returns Number of subjects deleted
	 */
	static async cleanupUnverified(db: Database, olderThan: number) {
		let cutoffDate = new Date(Date.now() - olderThan).toISOString();
		let unverifiedSubjects = await db.findMany(Subject.table, {
			where: { email_verified_at: null },
		});

		let toDelete = unverifiedSubjects.filter((subject) => subject.created_at < cutoffDate);

		if (toDelete.length === 0) return 0;

		await Promise.all(toDelete.map((subject) => db.delete(Subject.table, { id: subject.id })));

		return toDelete.length;
	}
}
