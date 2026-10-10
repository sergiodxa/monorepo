/**
 * TCP monitors: a team's watched host and port pairs, the claim each sweep runs to take the
 * monitors whose `interval_seconds` has come round, and the single `recordCheckResult` write
 * both the scheduled job and "Check now" use, so history and cached fields never drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";

import type { TcpCheckResult } from "~/app/services/tcp-check";
import type { SelectTcpMonitor } from "~/database/schema";

import { claimDue, nextDueAtOnEnable, nextDueAtPatch } from "~/app/lib/scheduling";
import { tcpMonitorResults, tcpMonitors } from "~/database/schema";

/**
 * What a claimed monitor's check needs to read. Adding a column the check uses is one edit
 * here: {@link ClaimedTcpMonitor} and `claimDue`'s return type both follow. `team_id` rides
 * along so the sweep can apportion its cost across teams.
 */
const CLAIM_COLUMNS = ["id", "team_id", "host", "port", "timeout_ms", "last_status"] as const;

/** A TCP monitor claimed for a check, projected to the columns the check reads. */
export type ClaimedTcpMonitor = Pick<SelectTcpMonitor, (typeof CLAIM_COLUMNS)[number]>;

export const TcpMonitors = createModel(tcpMonitors, {
	optional: ["id", "timeout_ms", "interval_seconds", "is_enabled"],

	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
	},

	methods: {
		/**
		 * Claims every TCP monitor whose next check is due as of `scheduledAt`, across every team,
		 * advancing each one's next due time as it does, so concurrent deliveries never claim the
		 * same monitor twice.
		 */
		claimDue(scheduledAt: number) {
			return claimDue(this.db, tcpMonitors, CLAIM_COLUMNS, scheduledAt);
		},

		/**
		 * Records a check's outcome: inserts a history row and updates the monitor's cached fields.
		 *
		 * @returns The history row's id. It is the only thing about a completed check that is
		 * unique and already persisted, which is what makes it the idempotency key the ping
		 * meter bills against: a redelivery of the same recorded check meters once.
		 */
		async recordCheckResult(monitorId: string, result: TcpCheckResult): Promise<string> {
			let checkedAt = Date.now();
			let id = generateUUID();

			await this.db.create(
				tcpMonitorResults,
				{
					id,
					tcp_monitor_id: monitorId,
					status: result.status,
					response_time_ms: result.responseTimeMs,
					error_message: result.errorMessage ?? null,
					checked_at: checkedAt,
				},
				{ touch: true },
			);

			unwrap(
				await this.update(monitorId, {
					last_checked_at: checkedAt,
					last_status: result.status,
					last_response_time_ms: result.responseTimeMs,
				}),
			);

			return id;
		},
	},

	callbacks: {
		/**
		 * A new monitor is enabled unless the caller says otherwise (matching the column's own
		 * default) and due at once, so it reports its first status on the next cron tick.
		 */
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? generateUUID(),
				next_due_at: nextDueAtOnEnable(values.is_enabled ?? true),
			};
		},

		/** Keeps `next_due_at` consistent with an edit that changes whether or how often it runs. */
		async beforeUpdate(values, ctx, before) {
			let patch = await nextDueAtPatch(ctx.db, tcpMonitors, before.id, {
				enabled: values.is_enabled,
				intervalSeconds: values.interval_seconds,
			});
			return { ...values, ...patch };
		},

		/** Removes the monitor's check history with it, which nothing else would ever reach. */
		async beforeDelete(row, ctx) {
			await ctx.models.tcpMonitorResults.forMonitor(row.id).delete();
		},
	},
});

/** A TCP monitor, as reads return it. */
export type TcpMonitor = ModelRow<typeof TcpMonitors>;

export default TcpMonitors;
