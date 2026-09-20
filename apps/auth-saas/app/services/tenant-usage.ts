/**
 * Folds one tenant's daily active user meter into the control plane once its
 * day is done: closes the day on the tenant's own Durable Object, then writes
 * the figures it answers with into `tenant_usage_day`, the interface the cost
 * ledger and usage reporting both read.
 *
 * Nothing here runs on a schedule yet — a scheduled job, once one exists,
 * calls `closeTenantMeteringDay` for every tenant the control plane records as
 * having authenticated that day, the same way the mail rate limit's and the
 * entitlement projection's own sweeps are still waiting on one shared trigger.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import type Tenant from "~/database/tenant-do";

import TenantUsageDay from "~/app/models/tenant-usage-day";

/** What a closed day is folded from the tenant's own record and into whom. */
export interface CloseTenantMeteringDayInput {
	tenantId: string;
	day: number;
}

/**
 * Closes one tenant's metering day and writes the resulting figures into the
 * control plane. Safe to call twice for the same day: the tenant object's own
 * close is idempotent, and this write always overwrites wholesale rather than
 * accumulating.
 *
 * @param stub - The tenant's Durable Object stub.
 * @param db - The control plane's database.
 * @param input - The tenant and the day to close.
 * @returns The written row: the day and its subject, session and token counts.
 */
export async function closeTenantMeteringDay(
	stub: DurableObjectStub<Tenant>,
	db: Database,
	input: CloseTenantMeteringDayInput,
) {
	let usage = await stub.closeMeteringDay({ day: input.day });
	return TenantUsageDay.upsert(db, input.tenantId, usage);
}
