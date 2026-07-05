/**
 * Model for password credentials associated with a subject.
 *
 * Stores a bcrypt password hash per subject and provides creation, verification,
 * and password-update helpers. Raw passwords are never stored; only the hash is
 * persisted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import bcrypt from "bcryptjs";
import { column as c, table } from "remix/data-table";

/**
 * Persistence model for a subject's password credential (bcrypt hash).
 */
export default class Credential {
	/** Error thrown when no credential exists for the given subject. */
	static InvalidCredentialError = class extends Error {
		override name = "InvalidCredentialError";
	};

	/** Database table schema for credentials. */
	static table = table({
		name: "credentials",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			subject_id: c.text(),
			password_hash: c.text(),
			verified_at: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Finds the credential belonging to a subject.
	 * @param db - Database instance.
	 * @param subjectId - Subject ID.
	 * @returns Credential record or null if none exists.
	 */
	static findBySubject(db: Database, subjectId: string) {
		return db.findOne(Credential.table, { where: { subject_id: subjectId } });
	}

	/**
	 * Creates a password credential for a subject, storing only the bcrypt hash.
	 * @param db - Database instance.
	 * @param subjectId - Subject the credential belongs to.
	 * @param password - Plaintext password to hash and store.
	 * @returns The created credential write result.
	 */
	static async create(db: Database, subjectId: string, password: string) {
		let passwordHash = await bcrypt.hash(password, 10);

		return await db.create(Credential.table, {
			id: crypto.randomUUID(),
			subject_id: subjectId,
			password_hash: passwordHash,
			verified_at: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});
	}

	/**
	 * Verifies a plaintext password against the subject's stored hash.
	 * @param db - Database instance.
	 * @param subjectId - Subject whose credential to check.
	 * @param password - Plaintext password to compare.
	 * @returns True if the password matches the stored hash.
	 * @throws {InvalidCredentialError} If the subject has no credential.
	 * @example
	 * if (await Credential.verify(db, subject.id, password)) grantAccess();
	 */
	static async verify(db: Database, subjectId: string, password: string): Promise<boolean> {
		let credential = await this.findBySubject(db, subjectId);
		if (!credential) throw new this.InvalidCredentialError();
		return await bcrypt.compare(password, credential.password_hash);
	}

	/**
	 * Replaces the subject's stored password with a new bcrypt hash.
	 * @param db - Database instance.
	 * @param subjectId - Subject whose password to update.
	 * @param password - New plaintext password to hash and store.
	 * @returns The update result.
	 * @throws {InvalidCredentialError} If the subject has no credential.
	 */
	static async updatePassword(db: Database, subjectId: string, password: string) {
		let credential = await this.findBySubject(db, subjectId);
		if (!credential) throw new this.InvalidCredentialError();

		let passwordHash = await bcrypt.hash(password, 10);

		return await db.update(
			Credential.table,
			{ id: credential.id },
			{
				password_hash: passwordHash,
				updated_at: new Date().toISOString(),
			},
		);
	}
}
