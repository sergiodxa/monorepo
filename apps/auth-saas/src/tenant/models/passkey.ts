import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Passkey {
	static table = createTable({
		name: "passkeys",
		primaryKey: ["id"],
		columns: {
			/** Database primary key (UUID). */
			id: s.string(),
			subject_id: s.string(),
			/** WebAuthn credential ID (base64url encoded). Used for allowCredentials in authentication. */
			credential_id: s.string(),
			public_key: s.string(),
			counter: s.number(),
			device_type: s.nullable(s.string()),
			backed_up: s.defaulted(s.boolean(), false),
			transports: s.nullable(s.string()),
			name: s.nullable(s.string()),
			created_at: s.string(),
			last_used_at: s.nullable(s.string()),
		},
	});

	static listBySubject(db: Database, subjectId: string) {
		return db.findMany(Passkey.table, { where: { subject_id: subjectId } });
	}

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

	static async rename(db: Database, id: string, name: string) {
		let passkey = await db.findOne(Passkey.table, { where: { id } });
		if (!passkey) throw new RecordNotFoundError(Passkey.table, { id });

		return await db.update(Passkey.table, { id }, { name });
	}

	static async destroy(db: Database, id: string) {
		let passkey = await db.findOne(Passkey.table, { where: { id } });
		if (!passkey) throw new RecordNotFoundError(Passkey.table, { id });
		return await db.delete(Passkey.table, { id });
	}
}
