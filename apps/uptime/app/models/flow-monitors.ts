/**
 * Flow monitors: a team's executable specs, the claim each sweep runs to take the monitors
 * whose `interval_seconds` has come round, and the single `recordCheckResult` write. Only the
 * intervals in `FLOW_INTERVALS_SECONDS` are accepted, so a priced cadence is the only one stored.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { fail } from "remix/data-table";

import type { FlowCheckResult } from "~/app/services/flow-check";
import type { SelectFlowMonitor } from "~/database/schema";

import { DEFAULT_FLOW_INTERVAL_SECONDS, isFlowIntervalSeconds } from "~/app/lib/pricing";
import { claimDue, nextDueAtOnEnable, nextDueAtPatch } from "~/app/lib/scheduling";
import { flowMonitorResults, flowMonitors } from "~/database/schema";

/**
 * The columns a claimed monitor's check reads. `team_id` rides along so the sweep can
 * apportion its own cost across the teams it swept and bill each run to one of them, which
 * the `RETURNING` projection provides for free.
 */
const CLAIM_COLUMNS = ["id", "team_id", "source", "last_status"] as const;

/** A flow monitor claimed for a check, projected to the columns the check reads. */
export type ClaimedFlowMonitor = Pick<SelectFlowMonitor, (typeof CLAIM_COLUMNS)[number]>;

export const FlowMonitors = createModel(flowMonitors, {
	optional: ["id", "interval_seconds", "is_enabled"],

	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
	},

	methods: {
		/**
		 * Claims every flow monitor whose next check is due as of `scheduledAt`, across every
		 * team, advancing each one's next due time as it does, so concurrent deliveries never
		 * claim the same monitor twice.
		 */
		claimDue(scheduledAt: number) {
			return claimDue(this.db, flowMonitors, CLAIM_COLUMNS, scheduledAt);
		},

		/**
		 * Records a run's outcome: inserts a history row and updates the monitor's cached fields.
		 *
		 * @returns The history row's id, the idempotency key the ping meter bills against: it is
		 * the only thing about a completed run that is unique and already persisted.
		 */
		async recordCheckResult(monitorId: string, result: FlowCheckResult): Promise<string> {
			let checkedAt = Date.now();
			let id = generateUUID();

			await this.db.create(
				flowMonitorResults,
				{
					id,
					flow_monitor_id: monitorId,
					status: result.status,
					tests_total: result.testsTotal,
					tests_passed: result.testsPassed,
					tests_failed: result.testsFailed,
					requests_made: result.requestsMade,
					failed_test: result.failedTest,
					failed_at_line: result.failedAtLine,
					failure_detail: result.failureDetail,
					duration_ms: result.durationMs,
					error_message: result.errorMessage,
					checked_at: checkedAt,
				},
				{ touch: true },
			);

			unwrap(
				await this.update(monitorId, { last_checked_at: checkedAt, last_status: result.status }),
			);

			return id;
		},
	},

	callbacks: {
		/** Refuses an interval outside the selectable list, on create and on edit alike. */
		async validate(values) {
			if (values.interval_seconds === undefined) return;
			if (isFlowIntervalSeconds(values.interval_seconds)) return;
			return fail(`${values.interval_seconds} is not a selectable flow monitor interval.`, [
				"interval_seconds",
			]);
		},

		/**
		 * A new monitor runs hourly unless told otherwise, is enabled unless the caller says so,
		 * and is due at once, so it reports a status instead of waiting one silent interval.
		 */
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? generateUUID(),
				interval_seconds: values.interval_seconds ?? DEFAULT_FLOW_INTERVAL_SECONDS,
				next_due_at: nextDueAtOnEnable(values.is_enabled ?? true),
			};
		},

		/** Keeps `next_due_at` consistent with an edit that changes whether or how often it runs. */
		async beforeUpdate(values, ctx, before) {
			let patch = await nextDueAtPatch(ctx.db, flowMonitors, before.id, {
				enabled: values.is_enabled,
				intervalSeconds: values.interval_seconds,
			});
			return { ...values, ...patch };
		},

		/** Removes the monitor's run history with it, which nothing else would ever reach. */
		async beforeDelete(row, ctx) {
			await ctx.models.flowMonitorResults.forMonitor(row.id).delete();
		},
	},
});

/** A flow monitor, as reads return it. */
export type FlowMonitor = ModelRow<typeof FlowMonitors>;

export default FlowMonitors;
