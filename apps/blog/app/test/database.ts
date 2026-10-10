/**
 * Threads-pool test support: a fresh in-memory D1 binding, migrated, behind the same
 * D1 adapter production uses, so a job or repository test runs real SQL without
 * workerd.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createD1Database } from "@sdxc/cloudflare-mocks";

import { openDatabase } from "~/app/services/database";

import { applyMigrations } from "./fixtures";

/**
 * @returns A migrated database no other test shares.
 */
export async function testDatabase(): Promise<Database> {
	let binding = createD1Database();
	await applyMigrations(binding);
	return openDatabase(binding);
}
