/**
 * Folds one tenant's daily active user meter into the control plane once its day
 * is done: closes the day on the tenant's own Durable Object, then writes the
 * figures it answers with into `tenant_usage_day`, the interface the cost ledger
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";

import type { Models } from "~/app/models";
import type Tenant from "~/app/models/tenant/object";

/** What a closed day is folded from the tenant's own record and into whom. */
export interface CloseTenantMeteringDayInput {
	tenantId: string;
	day: number;
}

/**
 * Closes one tenant's metering day and writes the resulting figures into the
 * control plane. Safe to call twice for the same day: the tenant object's own
 * close is idempotent, and this write always overwrites wholesale rather than
 *
 * @param stub - The tenant's Durable Object stub.
 * @param models - The control plane's models.
 * @param input - The tenant and the day to close.
 * @returns The written row: the day and its subject, session and token counts.
 */
export async function closeTenantMeteringDay(
	stub: DurableObjectStub<Tenant>,
	models: Models,
	input: CloseTenantMeteringDayInput,
) {
	let usage = await stub.closeMeteringDay({ day: input.day });
	return unwrap(await models.tenantUsageDays.upsert({ tenant_id: input.tenantId, ...usage }));
}
