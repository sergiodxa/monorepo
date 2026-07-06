/**
 * Model for WebAuthn passkey credentials registered by subjects.
 *
 * Stores each authenticator's public key, signature counter, and metadata, and
 * provides lookup by credential id plus counter updates, renaming, and deletion
 * used across the WebAuthn registration and authentication flows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "../../shared/lib/db-errors";

/**
 * Persistence model for a subject's registered WebAuthn passkeys.
 */
export default class Passkey {
	/** Database table schema for passkeys. */
	static table = table({
		name: "passkeys",
		primaryKey: ["id"],
		columns: {
			/** Database primary key (UUID). */
			id: c.text(),
			subject_id: c.text(),
			/** WebAuthn credential ID (base64url encoded). Used for allowCredentials in authentication. */
			credential_id: c.text().nullable(),
			public_key: c.text(),
			counter: c.integer(),
			device_type: c.text().nullable(),
			backed_up: c.boolean().default(false),
			transports: c.text().nullable(),
			name: c.text().nullable(),
			created_at: c.text(),
			last_used_at: c.text().nullable(),
		},
	});

	/**
	 * Lists all passkeys registered by a subject.
	 * @param db - Database instance.
	 * @param subjectId - Subject ID to filter by.
	 * @returns Array of passkey records for the subject.
	 */
	static listBySubject(db: Database, subjectId: string) {
		return db.findMany(Passkey.table, { where: { subject_id: subjectId } });
	}

	/**
	 * Lists a subject's passkeys that can be used for authentication, i.e. those
	 * with a stored WebAuthn `credential_id`. Legacy rows migrated before the
	 * credential id was persisted (see migration 0006) have a null `credential_id`
	 * and are excluded, since they cannot appear in `allowCredentials` nor be matched
	 * against an assertion.
	 * @param db - Database instance.
	 * @param subjectId - Subject ID to filter by.
	 * @returns Passkeys for the subject that have a non-null `credential_id`.
	 */
	static async listForAuthentication(db: Database, subjectId: string) {
		let passkeys = await Passkey.listBySubject(db, subjectId);
		return passkeys.filter((passkey) => passkey.credential_id != null);
	}

	/**
	 * Retrieves a single passkey by its primary key.
	 * @param db - Database instance.
	 * @param id - Passkey ID.
	 * @returns Passkey record or null if not found.
	 */
	static show(db: Database, id: string) {
		return db.findOne(Passkey.table, { where: { id } });
	}

	/**
	 * Finds a passkey by its WebAuthn credential ID.
	 * @param db - Database instance
	 * @param credentialId - WebAuthn credential ID (base64url encoded)
	 * @returns Passkey record or null if not found
	 */
	static findByCredentialId(db: Database, credentialId: string) {
		return db.findOne(Passkey.table, { where: { credential_id: credentialId } });
	}

	/**
	 * Persists a newly registered passkey credential for a subject.
	 * @param db - Database instance.
	 * @param data - Credential material and metadata from the authenticator.
	 * @returns The created passkey write result.
	 * @example
	 * await Passkey.create(db, { subjectId, credentialId, publicKey, counter: 0 });
	 */
	static async create(
		db: Database,
		data: {
			subjectId: string;
			/** WebAuthn credential ID (base64url encoded from authenticator). */
			credentialId: string;
			publicKey: string;
			counter: number;
			deviceType?: string | null;
			backedUp?: boolean;
			transports?: string | null;
			name?: string | null;
		},
	) {
		return await db.create(Passkey.table, {
			id: crypto.randomUUID(),
			subject_id: data.subjectId,
			credential_id: data.credentialId,
			public_key: data.publicKey,
			counter: data.counter,
			device_type: data.deviceType ?? null,
			backed_up: data.backedUp ?? false,
			transports: data.transports ?? null,
			name: data.name ?? null,
			created_at: new Date().toISOString(),
			last_used_at: null,
		});
	}

	/**
	 * Updates a passkey's signature counter and last-used timestamp after a
	 * successful authentication (used to detect cloned authenticators).
	 * @param db - Database instance.
	 * @param id - Passkey ID.
	 * @param counter - New signature counter reported by the authenticator.
	 * @returns The update result.
	 * @throws {RecordNotFoundError} If the passkey does not exist.
	 */
	static async updateCounter(db: Database, id: string, counter: number) {
		let passkey = await db.findOne(Passkey.table, { where: { id } });
		if (!passkey) throw new RecordNotFoundError(Passkey.table, { id });

		return await db.update(
			Passkey.table,
			{ id },
			{
				counter,
				last_used_at: new Date().toISOString(),
			},
		);
	}

	/**
	 * Renames a passkey (its user-facing label).
	 * @param db - Database instance.
	 * @param id - Passkey ID.
	 * @param name - New display name.
	 * @returns The update result.
	 * @throws {RecordNotFoundError} If the passkey does not exist.
	 */
	static async rename(db: Database, id: string, name: string) {
		let passkey = await db.findOne(Passkey.table, { where: { id } });
		if (!passkey) throw new RecordNotFoundError(Passkey.table, { id });

		return await db.update(Passkey.table, { id }, { name });
	}

	/**
	 * Deletes a passkey credential.
	 * @param db - Database instance.
	 * @param id - Passkey ID.
	 * @returns Deletion result.
	 * @throws {RecordNotFoundError} If the passkey does not exist.
	 */
	static async destroy(db: Database, id: string) {
		let passkey = await db.findOne(Passkey.table, { where: { id } });
		if (!passkey) throw new RecordNotFoundError(Passkey.table, { id });
		return await db.delete(Passkey.table, { id });
	}
}
