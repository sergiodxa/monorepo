/**
 * A tenant's closed daily usage: what the cost ledger and usage reporting both read, written
 * once per tenant per day when the tenant object's meter closes the day. One row per
 * `(tenant_id, day)`, with the day as metering's `dayOf` keys it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";

import { tenantUsageDays } from "~/database/schema";

/**
 * Daily usage rows. A retried close answers the same figures, so `upsert` writing them again
 * lands the same row.
 *
 * @example await models.tenantUsageDays.upsert({ tenant_id, day, subjects, sessions, tokens });
 */
export const TenantUsageDays = createModel(tenantUsageDays, {
	scopes: {
		onDay: (query, day: number) => query.where({ day }),
	},
});

/** One tenant's usage row for one day, as the control plane stores it. */
export type TenantUsageDayRow = ModelRow<typeof TenantUsageDays>;

export default TenantUsageDays;
