/**
 * Data access for password credentials. A subject has at most one, so this is a
 * lookup by subject and an insert of a password hash — the two operations the password
 * login and registration flows need, kept away from the hashing itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { SelectCredential } from "~/database/schema";

import { credentials } from "~/database/schema";

export default class Credential {
	/** Finds a subject's password credential, or `null` when it signs in another way. */
	static async find(db: Database, subjectId: string): Promise<SelectCredential | null> {
		return await db.findOne(credentials, { where: { subject_id: subjectId } });
	}

	/**
	 * Stores a password credential for a subject. `password_hash` must already be a
	 * PBKDF2 hash: this never sees a plaintext password.
	 *
	 * @param verifiedAt - Epoch milliseconds at which the credential became usable, or
	 *   `null` to store it unusable — sign-in refuses a credential with no `verified_at`,
	 *   and nothing in this server sets the column afterwards, so `null` means "this
	 *   password can never be used" rather than "not yet".
	 */
	static async create(
		db: Database,
		subjectId: string,
		passwordHash: string,
		verifiedAt: number | null,
	): Promise<SelectCredential> {
		return await db.create(
			credentials,
			{
				id: generateUUID(),
				subject_id: subjectId,
				password_hash: passwordHash,
				verified_at: verifiedAt,
			},
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * Replaces the stored hash for a subject that already has a credential, which is
	 * how a hash written under an older scheme is retired after it verified.
	 *
	 * Scoped by subject and never an insert: a subject with no credential must stay
	 * without one rather than gain a password they never set.
	 *
	 * @returns How many credentials were rewritten — zero when the subject has none.
	 */
	static async updatePasswordHash(
		db: Database,
		subjectId: string,
		passwordHash: string,
	): Promise<number> {
		let result = await db.updateMany(
			credentials,
			{ password_hash: passwordHash },
			{ where: { subject_id: subjectId } },
		);

		return result.affectedRows ?? 0;
	}

	/**
	 * Sets a subject's password to a new hash and marks the credential usable, creating it
	 * when the subject had none.
	 *
	 * `verified_at` is stamped because the only caller has already established that whoever
	 * is doing this reads the account's inbox: the column records that this password is
	 * known to belong to this account, and inbox control is the strongest proof of that
	 * this server can obtain. Leaving it null would store a hash sign-in refuses forever,
	 * which is the failure the recovery flow exists to end rather than to reproduce.
	 *
	 * Two statements rather than one because the database has no interactive transactions:
	 * the update is attempted first and an insert only follows when it matched nothing, so
	 * a failure between them leaves either the old credential or none — never a half-written
	 * one.
	 *
	 * @param passwordHash - An already-derived PBKDF2 hash; this never sees a plaintext password.
	 * @param verifiedAt - Epoch milliseconds the credential became usable at.
	 */
	static async setVerifiedPassword(
		db: Database,
		subjectId: string,
		passwordHash: string,
		verifiedAt: number,
	): Promise<void> {
		let result = await db.updateMany(
			credentials,
			{ password_hash: passwordHash, verified_at: verifiedAt, updated_at: Date.now() },
			{ where: { subject_id: subjectId } },
		);

		if ((result.affectedRows ?? 0) > 0) return;

		await Credential.create(db, subjectId, passwordHash, verifiedAt);
	}
}
