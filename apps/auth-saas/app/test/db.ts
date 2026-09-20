/**
 * In-memory {@link Database} harness for auth-saas unit tests. Applies every
 * control-plane D1 migration, in order, to a fresh `@sdxc/cloudflare-mocks` D1
 * database and wraps it with the real `@sdxc/data-table-d1` adapter, so a model or
 * service test exercises the same generated SQL production runs against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createD1Database } from "@sdxc/cloudflare-mocks";
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { Database } from "remix/data-table";

import controlPlaneMigration from "~/database/migrations/0001-control-plane.sql?raw";
import perTenantSubscriptionsMigration from "~/database/migrations/0002-per-tenant-subscriptions.sql?raw";

/** Every control-plane migration, applied in order. */
const MIGRATIONS = [controlPlaneMigration, perTenantSubscriptionsMigration];

/**
 * Creates an isolated in-memory control-plane database with the D1 schema applied.
 *
 * @returns A `remix/data-table` handle over a fresh in-memory D1 mock.
 * @example
 * let db = await createTestDatabase();
 */
export async function createTestDatabase(): Promise<Database> {
	let binding = createD1Database();
	for (let migration of MIGRATIONS) await binding.exec(migration);
	return new Database(createD1DatabaseAdapter(binding), { now: () => Date.now() });
}
