/**
 * Daily attack-signal alerts: the "was this tenant already mailed today" record the baseline
 * check consults before sending and writes once a send succeeds. A row's presence for a
 * `(tenant_id, day)` pair is the whole fact it holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";

import { attackSignalAlerts } from "~/database/schema";

/**
 * Attack-signal alerts, keyed on `{ tenant_id, day }` with the day as metering's `dayOf` keys it.
 *
 * @example let sentToday = await models.attackSignalAlerts.find({ tenant_id: tenantId, day });
 */
export const AttackSignalAlerts = createModel(attackSignalAlerts);

/** One recorded alert, as the control plane stores it. */
export type AttackSignalAlertRow = ModelRow<typeof AttackSignalAlerts>;

export default AttackSignalAlerts;
