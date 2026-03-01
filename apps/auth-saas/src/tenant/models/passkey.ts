import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

export default class Passkey {
	static table = createTable({
		name: "passkeys",
		primaryKey: ["id"],
		columns: {
			id: s.string(),
			subjectId: s.string(),
			publicKey: s.string(),
			counter: s.number(),
			deviceType: s.nullable(s.string()),
			backedUp: s.defaulted(s.boolean(), false),
			transports: s.nullable(s.string()),
			name: s.nullable(s.string()),
			createdAt: s.string(),
			lastUsedAt: s.nullable(s.string()),
		},
	});

	static listBySubject(db: Database, subjectId: string) {
		return db.findMany(Passkey.table, { where: { subjectId } });
	}

	static show(db: Database, id: string) {
		return db.findOne(Passkey.table, { where: { id } });
	}

	static async create(
		db: Database,
		data: {
			subjectId: string;
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
			subjectId: data.subjectId,
			publicKey: data.publicKey,
			counter: data.counter,
			deviceType: data.deviceType ?? null,
			backedUp: data.backedUp ?? false,
			transports: data.transports ?? null,
			name: data.name ?? null,
			createdAt: new Date().toISOString(),
			lastUsedAt: null,
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
				lastUsedAt: new Date().toISOString(),
			},
		);
	}

	static async destroy(db: Database, id: string) {
		let passkey = await db.findOne(Passkey.table, { where: { id } });
		if (!passkey) throw new RecordNotFoundError(Passkey.table, { id });
		return await db.delete(Passkey.table, { id });
	}
}
