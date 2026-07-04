import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "../../shared/lib/db-errors";

/**
 * Model for subjects (users).
 * Manages user registration, profile updates, and email verification.
 */
export default class Subject {
	/** Error thrown when an operation requires a verified email. */
	static UnverifiedEmailError = class extends Error {
		override name = "UnverifiedEmailError";
	};

	/** Error thrown when a username is already taken by another subject. */
	static UsernameAlreadyTakenError = class extends Error {
		override name = "UsernameAlreadyTakenError";
		constructor(username: string) {
			super(`Username "${username}" is already taken`);
		}
	};

	/** Error thrown when importing a subject whose id or email already exists. */
	static ConflictError = class extends Error {
		override name = "SubjectConflictError";
		constructor(message: string) {
			super(message);
		}
	};

	/** Database table schema for subjects. */
	static table = table({
		name: "subjects",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			email: c.text(),
			email_verified_at: c.text().nullable(),
			display_name: c.text().nullable(),
			username: c.text(),
			avatar_url: c.text().nullable(),
			role: c.enum(["admin", "user"]).default("user"),
			created_at: c.text(),
			updated_at: c.text(),
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
		return await db.count(Subject.table);
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
	 * Finds a subject by username.
	 * @param db - Database instance
	 * @param username - Username
	 * @returns Subject record or null if not found
	 */
	static findByUsername(db: Database, username: string) {
		return db.findOne(Subject.table, { where: { username } });
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
	 * Imports a subject from another identity store, preserving its id so the OIDC
	 * `sub` stays stable and client apps keep their local `subject_id` links.
	 * Verified-email timestamps carry over; imported subjects have no passkeys and
	 * must add one via the magic-link flow on first login.
	 * @param db - Database instance.
	 * @param data - Source subject fields (id required; timestamps as ISO strings).
	 * @returns The imported subject record.
	 * @throws {Subject.ConflictError} When the id or email already exists.
	 */
	static async import(
		db: Database,
		data: {
			id: string;
			email: string;
			username: string;
			emailVerifiedAt?: string | null;
			displayName?: string | null;
			avatarUrl?: string | null;
			createdAt?: string;
		},
	) {
		let existingById = await db.findOne(Subject.table, { where: { id: data.id } });
		if (existingById) throw new Subject.ConflictError(`Subject "${data.id}" already exists`);

		let existingByEmail = await Subject.findByEmail(db, data.email);
		if (existingByEmail) throw new Subject.ConflictError(`Email "${data.email}" already exists`);

		let now = new Date().toISOString();
		await db.create(Subject.table, {
			id: data.id,
			email: data.email,
			email_verified_at: data.emailVerifiedAt ?? null,
			display_name: data.displayName ?? null,
			username: data.username,
			avatar_url: data.avatarUrl ?? null,
			role: "user",
			created_at: data.createdAt ?? now,
			updated_at: now,
		});

		let subject = await db.findOne(Subject.table, { where: { id: data.id } });
		if (!subject) throw new Error("Failed to import subject");
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
	 * @throws {UsernameAlreadyTakenError} If username is taken by another subject
	 */
	static async update(
		db: Database,
		id: string,
		data: { displayName?: string; avatarUrl?: string; username?: string },
	) {
		let subject = await db.findOne(Subject.table, { where: { id } });
		if (!subject) throw new RecordNotFoundError(Subject.table, { id });

		// Check username uniqueness if being changed
		if (data.username && data.username !== subject.username) {
			let existing = await Subject.findByUsername(db, data.username);
			if (existing && existing.id !== id) {
				throw new Subject.UsernameAlreadyTakenError(data.username);
			}
		}

		return await db.update(
			Subject.table,
			{ id },
			{
				display_name: data.displayName ?? subject.display_name,
				avatar_url: data.avatarUrl ?? subject.avatar_url,
				username: data.username ?? subject.username,
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
