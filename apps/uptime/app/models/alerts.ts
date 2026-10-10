/**
 * A team's alerts: where a check result is announced and how often. Scoping is the
 * `(monitor_type, monitor_id)` pair from `~/app/lib/monitor-scope`, so an alert watches
 * everything, one monitor type, or one monitor of one type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v4";

import type { MonitorScopeType } from "~/app/lib/monitor-scope";
import type { SelectAlert } from "~/database/schema";

import { monitorScopeMatches, storedMonitorScope } from "~/app/lib/monitor-scope";
import { alerts } from "~/database/schema";

/** Per-team limit from `docs/alerts.md`. */
export const MAX_ALERTS_PER_TEAM = 10;

export const Alerts = createModel(alerts, {
	optional: ["id", "notify_on_recovery", "cooldown_minutes"],

	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
	},

	methods: {
		/**
		 * Every alert applicable to a monitor's check result, monitor-scoped rows first so the
		 * specific ones keep precedence. Two concurrent seeks on `alerts_team_monitor_idx` beat an
		 * `OR` SQLite full-scans, and {@link MAX_ALERTS_PER_TEAM} keeps type matching in memory.
		 */
		async listForMonitor(
			teamId: string,
			monitorType: MonitorScopeType,
			monitorId: string,
		): Promise<SelectAlert[]> {
			let [monitorScoped, unscopedByMonitor] = await Promise.all([
				this.inTeam(teamId).where({ monitor_id: monitorId }).all(),
				this.inTeam(teamId).where({ monitor_id: null }).all(),
			]);

			return [...monitorScoped, ...unscopedByMonitor].filter((alert) =>
				monitorScopeMatches(storedMonitorScope(alert), monitorType, monitorId),
			);
		},

		/**
		 * Marks the alert's destination as gone, so the alert list tells its owner the channel
		 * stopped existing. `updated_at` keeps the owner's last edit, since nobody edited it.
		 *
		 * @param reason The platform's own words, shown beside the badge.
		 */
		async markBroken(alertId: string, reason: string): Promise<void> {
			await this.db.update(
				alerts,
				alertId,
				{ broken_at: Date.now(), broken_reason: reason },
				{ touch: false },
			);
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},

		/**
		 * Saving a `config` clears the broken mark, since a channel saved again is the owner's
		 * answer to it; the next delivery confirms it.
		 */
		async beforeUpdate(values) {
			if (values.config === undefined) return values;
			return { ...values, broken_at: null, broken_reason: null };
		},
	},
});

/** An alert, as reads return it. */
export type Alert = ModelRow<typeof Alerts>;

export default Alerts;
