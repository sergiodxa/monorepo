/**
 * Model for tenant metadata key-value storage.
 *
 * Persists per-tenant configuration such as issuer URL, tenant id, and region,
 * with a short per-tenant in-memory cache for the frequently-read issuer value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/**
 * Cache TTL for tenant meta values (1 minute in milliseconds).
 * Tenant metadata rarely changes, but we keep TTL short for safety.
 */
const TENANT_META_CACHE_TTL_MS = 60_000;

/** Cache structure for tenant meta values. */
interface MetaCache {
	value: string | null;
	expiresAt: number;
}

/**
 * Model for tenant metadata key-value storage.
 * Stores configuration like issuer URL, tenant ID, and region.
 * Frequently accessed values are cached in-memory for performance.
 */
export default class TenantMeta {
	/**
	 * In-memory issuer cache, keyed by the tenant's `Database` instance. Multiple
	 * tenant Durable Objects can share one Worker isolate, so a single static cache
	 * would leak one tenant's issuer to another; keying by `db` scopes it per tenant.
	 */
	static #issuerCache = new WeakMap<Database, MetaCache>();

	/** Database table schema for tenant metadata. */
	static table = table({
		name: "tenant_meta",
		primaryKey: ["key"],
		columns: {
			key: c.text(),
			value: c.text(),
		},
	});

	/** Standard metadata keys. */
	static KEYS = {
		TENANT_ID: "tenant_id",
		ISSUER: "issuer",
		REGION: "region",
		CREATED_AT: "created_at",
	} as const;

	/**
	 * Retrieves a metadata value by key.
	 * @param db - Database instance
	 * @param key - Metadata key
	 * @returns Value or null if not found
	 */
	static async get(db: Database, key: string): Promise<string | null> {
		let record = await db.findOne(TenantMeta.table, { where: { key } });
		return record?.value ?? null;
	}

	/**
	 * Sets a metadata value, creating or updating as needed.
	 * @param db - Database instance
	 * @param key - Metadata key
	 * @param value - Value to store
	 */
	static async set(db: Database, key: string, value: string): Promise<void> {
		let existing = await db.findOne(TenantMeta.table, { where: { key } });

		if (existing) {
			await db.update(TenantMeta.table, { key }, { value });
		} else {
			await db.create(TenantMeta.table, { key, value });
		}
	}

	/**
	 * Retrieves all metadata as a key-value object.
	 * @param db - Database instance
	 * @returns Object containing all metadata key-value pairs
	 */
	static async getAll(db: Database): Promise<Record<string, string>> {
		let records = await db.findMany(TenantMeta.table);
		return Object.fromEntries(records.map((r) => [r.key, r.value]));
	}

	/**
	 * Retrieves the issuer URL with caching.
	 * Results are cached for 1 minute to improve performance.
	 * @param db - Database instance
	 * @returns Issuer URL or null if not configured
	 */
	static async getIssuer(db: Database): Promise<string | null> {
		let cached = TenantMeta.#issuerCache.get(db);
		if (cached && Date.now() < cached.expiresAt) return cached.value;

		let value = await TenantMeta.get(db, TenantMeta.KEYS.ISSUER);

		TenantMeta.#issuerCache.set(db, { value, expiresAt: Date.now() + TENANT_META_CACHE_TTL_MS });

		return value;
	}

	/**
	 * Sets the issuer URL and invalidates the cache.
	 * @param db - Database instance
	 * @param issuer - Issuer URL
	 */
	static async setIssuer(db: Database, issuer: string): Promise<void> {
		await TenantMeta.set(db, TenantMeta.KEYS.ISSUER, issuer);
		TenantMeta.#issuerCache.delete(db);
	}

	/**
	 * Retrieves the tenant ID.
	 * @param db - Database instance
	 * @returns Tenant ID or null if not configured
	 */
	static async getTenantId(db: Database): Promise<string | null> {
		return TenantMeta.get(db, TenantMeta.KEYS.TENANT_ID);
	}

	/**
	 * Sets the tenant ID.
	 * @param db - Database instance
	 * @param tenantId - Tenant ID
	 */
	static async setTenantId(db: Database, tenantId: string): Promise<void> {
		return TenantMeta.set(db, TenantMeta.KEYS.TENANT_ID, tenantId);
	}
}
