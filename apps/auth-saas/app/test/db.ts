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
import flagChangeMigration from "~/database/migrations/0003-flag-change.sql?raw";
import tenantUsageMigration from "~/database/migrations/0004-tenant-usage.sql?raw";
import managementApiMigration from "~/database/migrations/0005-management-api.sql?raw";
import attackSignalAlertsMigration from "~/database/migrations/0006-attack-signal-alerts.sql?raw";
import tenantImportRunsMigration from "~/database/migrations/0007-tenant-import-runs.sql?raw";
import transferDownloadTicketsMigration from "~/database/migrations/0008-transfer-download-tickets.sql?raw";
import tenantExportRunsMigration from "~/database/migrations/0009-tenant-export-runs.sql?raw";
import tenantMemberInvitationsMigration from "~/database/migrations/0010-tenant-member-invitations.sql?raw";
import pendingSignupsMigration from "~/database/migrations/0011-pending-signups.sql?raw";
import agentClientBindingsMigration from "~/database/migrations/0012-agent-client-bindings.sql?raw";

/** Every control-plane migration, applied in order. */
const MIGRATIONS = [
	controlPlaneMigration,
	perTenantSubscriptionsMigration,
	flagChangeMigration,
	tenantUsageMigration,
	managementApiMigration,
	attackSignalAlertsMigration,
	tenantImportRunsMigration,
	transferDownloadTicketsMigration,
	tenantExportRunsMigration,
	tenantMemberInvitationsMigration,
	pendingSignupsMigration,
	agentClientBindingsMigration,
];

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
