import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

// Cache TTL for tenant meta values (1 minute)
const TENANT_META_CACHE_TTL_MS = 60_000;

interface MetaCache {
	value: string | null;
	expiresAt: number;
}

export default class TenantMeta {
	// In-memory cache for frequently accessed values
	static #issuerCache: MetaCache | null = null;
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
		// Return cached value if still valid
		if (TenantMeta.#issuerCache && Date.now() < TenantMeta.#issuerCache.expiresAt) {
			return TenantMeta.#issuerCache.value;
		}

		let value = await TenantMeta.get(db, TenantMeta.KEYS.ISSUER);

		// Cache the value
		TenantMeta.#issuerCache = { value, expiresAt: Date.now() + TENANT_META_CACHE_TTL_MS };

		return value;
	}

	static async setIssuer(db: Database, issuer: string): Promise<void> {
		await TenantMeta.set(db, TenantMeta.KEYS.ISSUER, issuer);
		// Invalidate cache after setting
		TenantMeta.#issuerCache = null;
	}

	static async getTenantId(db: Database): Promise<string | null> {
		return TenantMeta.get(db, TenantMeta.KEYS.TENANT_ID);
	}

	static async setTenantId(db: Database, tenantId: string): Promise<void> {
		return TenantMeta.set(db, TenantMeta.KEYS.TENANT_ID, tenantId);
	}
}
