/**
 * Data-access model for flow monitors. Exposes CRUD over the `flow_monitors` table scoped to
 * a team, the claim each sweep runs to take the monitors whose `interval_seconds` has come
 * round, its `flow_monitor_results` history, and the single `recordCheckResult` write path
 * every caller uses, so a check's history-insert and cached-fields-update never drift apart.
 *
 * `interval_seconds` must be one of `FLOW_INTERVALS_SECONDS`, and that is enforced here rather
 * than left to callers because there is one write path and several of them. Refused, not
 * clamped: a caller asking for 60 seconds should be told no rather than given 900 and left to
 * find the difference in a latency chart.
 *
 * Which hosts a monitor may reach is deliberately not a column and not written here — it is
 * resolved from the team's verified domains on every run (see `flow-check.ts`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { FlowCheckResult } from "~/app/services/flow-check";
import type { InsertFlowMonitor, SelectFlowMonitor } from "~/database/schema";

import { DEFAULT_FLOW_INTERVAL_SECONDS, isFlowIntervalSeconds } from "~/app/lib/pricing";
import { claimDue, nextDueAtOnEnable, nextDueAtPatch } from "~/app/lib/scheduling";
import { flowMonitorResults, flowMonitors } from "~/database/schema";

/** Most-recent results shown on a monitor's detail page. */
const RESULT_HISTORY_LIMIT = 50;

/**
 * What a claimed monitor's check needs to read. Adding a column the check uses is one edit
 * here: {@link ClaimedFlowMonitor} and {@link FlowMonitor.claimDue}'s return type follow.
 *
 * `team_id` is not read by the check itself — the sweep apportions its own cost across the
 * teams whose monitors it swept (ADR-007 §5) and bills each run to one of them, and the
 * `RETURNING` projection is where that costs nothing.
 */
const CLAIM_COLUMNS = ["id", "team_id", "source", "last_status"] as const;

/** A flow monitor claimed for a check, projected to the columns the check reads. */
export type ClaimedFlowMonitor = Pick<SelectFlowMonitor, (typeof CLAIM_COLUMNS)[number]>;

/** What a caller may set on a flow monitor. */
export type FlowMonitorInput = InsertFlowMonitor;

export default class FlowMonitor {
	/**
	 * Creates a flow monitor for a team, enabled unless the caller says otherwise and
	 * scheduled for its first check on the next cron tick, so a new monitor reports a status
	 * straight away instead of after one silent interval.
	 *
	 * @throws If `interval_seconds` is not a selectable flow interval.
	 */
	static async create(db: Database, teamId: string, input: FlowMonitorInput) {
		let intervalSeconds = input.interval_seconds ?? DEFAULT_FLOW_INTERVAL_SECONDS;
		assertInterval(intervalSeconds);

		return await db.create(
			flowMonitors,
			{
				id: generateUUID(),
				team_id: teamId,
				...input,
				interval_seconds: intervalSeconds,
				next_due_at: nextDueAtOnEnable(input.is_enabled ?? true),
			},
			{ touch: true, returnRow: true },
		);
	}

	/** Lists every flow monitor for a team, most recently created first. */
	static async listByTeam(db: Database, teamId: string) {
		return await db.findMany(flowMonitors, {
			where: { team_id: teamId },
			orderBy: ["created_at", "desc"],
		});
	}

	/**
	 * Claims every flow monitor whose next check is due as of `scheduledAt`, across every
	 * team, advancing each one's next due time as it does — see `claimDue` for the semantics
	 * every monitor type shares.
	 */
	static async claimDue(db: Database, scheduledAt: number) {
		return await claimDue(db, flowMonitors, CLAIM_COLUMNS, scheduledAt);
	}

	/** Finds a single flow monitor scoped to a team, or `null` when it isn't theirs. */
	static async findByIdForTeam(db: Database, teamId: string, monitorId: string) {
		return await db.findOne(flowMonitors, { where: { id: monitorId, team_id: teamId } });
	}

	/**
	 * Updates a flow monitor's editable fields, keeping `next_due_at` consistent with them:
	 * scheduling lives entirely in that column, so an update that changes whether or how often
	 * a monitor should be checked has to move it in the same write.
	 *
	 * @throws If `interval_seconds` is present and is not a selectable flow interval.
	 */
	static async updateById(db: Database, monitorId: string, changes: Partial<FlowMonitorInput>) {
		if (changes.interval_seconds !== undefined) assertInterval(changes.interval_seconds);

		let patch = await nextDueAtPatch(db, flowMonitors, monitorId, {
			enabled: changes.is_enabled,
			intervalSeconds: changes.interval_seconds,
		});
		return await db.update(flowMonitors, monitorId, { ...changes, ...patch }, { touch: true });
	}

	/** Deletes a flow monitor and its check-result history. */
	static async deleteById(db: Database, monitorId: string) {
		let results = await db.findMany(flowMonitorResults, {
			where: { flow_monitor_id: monitorId },
		});
		for (let result of results) await db.delete(flowMonitorResults, result.id);
		return await db.delete(flowMonitors, monitorId);
	}

	/** Lists a monitor's most recent check results, newest first. */
	static async listResults(db: Database, monitorId: string, limit: number = RESULT_HISTORY_LIMIT) {
		return await db.findMany(flowMonitorResults, {
			where: { flow_monitor_id: monitorId },
			orderBy: ["checked_at", "desc"],
			limit,
		});
	}

	/**
	 * Records a check's outcome: inserts a history row and updates the monitor's cached fields.
	 *
	 * @returns The history row's id — the only thing about a completed check that is unique
	 * and already persisted, which is what makes it the idempotency key the ping meter bills
	 * against (see `TcpMonitor.recordCheckResult` for the full reasoning).
	 */
	static async recordCheckResult(
		db: Database,
		monitorId: string,
		result: FlowCheckResult,
	): Promise<string> {
		let checkedAt = Date.now();
		let id = generateUUID();

		await db.create(
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
			{ touch: true, returnRow: true },
		);

		await db.update(
			flowMonitors,
			monitorId,
			{ last_checked_at: checkedAt, last_status: result.status },
			{ touch: true },
		);

		return id;
	}
}

/**
 * Refuses an interval that is not on the list.
 *
 * @throws If `seconds` is not a selectable flow interval.
 */
function assertInterval(seconds: number): void {
	if (isFlowIntervalSeconds(seconds)) return;
	throw new Error(`${seconds} is not a selectable flow monitor interval.`);
}
