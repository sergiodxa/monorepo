import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

export default class TenantMeta {
	static table = createTable({
		name: "tenant_meta",
		primaryKey: ["key"],
		columns: {
			key: s.string(),
			value: s.string(),
		},
	});

	static KEYS = {
		TENANT_ID: "tenant_id",
		ISSUER: "issuer",
		REGION: "region",
		CREATED_AT: "created_at",
	} as const;

	static async get(db: Database, key: string): Promise<string | null> {
		let record = await db.findOne(TenantMeta.table, { where: { key } });
		return record?.value ?? null;
	}

	static async set(db: Database, key: string, value: string): Promise<void> {
		let existing = await db.findOne(TenantMeta.table, { where: { key } });

		if (existing) {
			await db.update(TenantMeta.table, { key }, { value });
		} else {
			await db.create(TenantMeta.table, { key, value });
		}
	}

	static async getAll(db: Database): Promise<Record<string, string>> {
		let records = await db.findMany(TenantMeta.table);
		return Object.fromEntries(records.map((r) => [r.key, r.value]));
	}

	static async getIssuer(db: Database): Promise<string | null> {
		return TenantMeta.get(db, TenantMeta.KEYS.ISSUER);
	}

	static async setIssuer(db: Database, issuer: string): Promise<void> {
		return TenantMeta.set(db, TenantMeta.KEYS.ISSUER, issuer);
	}
}
