/**
 * Data access for password credentials. A subject has at most one, so this is a
 * lookup by subject and an insert of a bcrypt hash — the two operations the password
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
	 * bcrypt hash: this never sees a plaintext password.
	 */
	static async create(
		db: Database,
		subjectId: string,
		passwordHash: string,
	): Promise<SelectCredential> {
		return await db.create(
			credentials,
			{ id: generateUUID(), subject_id: subjectId, password_hash: passwordHash },
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
}
