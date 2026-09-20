/**
 * In-memory {@link Database} harness for auth-saas unit tests. Applies the
 * control-plane D1 migration to a fresh `@sdxc/cloudflare-mocks` D1 database and wraps
 * it with the real `@sdxc/data-table-d1` adapter, so a model or service test exercises
 * the same generated SQL production runs against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createD1Database } from "@sdxc/cloudflare-mocks";
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { Database } from "remix/data-table";

import controlPlaneMigration from "~/database/migrations/0001-control-plane.sql?raw";

/**
 * Creates an isolated in-memory control-plane database with the D1 schema applied.
 *
 * @returns A `remix/data-table` handle over a fresh in-memory D1 mock.
 * @example
 * let db = await createTestDatabase();
 */
export async function createTestDatabase(): Promise<Database> {
	let binding = createD1Database();
	await binding.exec(controlPlaneMigration);
	return new Database(createD1DatabaseAdapter(binding), { now: () => Date.now() });
}
