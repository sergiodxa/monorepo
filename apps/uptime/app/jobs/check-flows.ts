/**
 * Claims the flow monitors whose interval has come round via an indexed range and
 * runs each through `runFlowCheck`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@sdxc/jobs";

import type { UptimeModels } from "~/app/models";
import type { ClaimedFlowMonitor } from "~/app/models/flow-monitors";
import type { FlowBillingPlan } from "~/app/services/flow-billing";
import type { FlowCheckResult } from "~/app/services/flow-check";
import type { NotifyMessage } from "~/app/services/notify-queue";
import type { FlowStatus } from "~/database/schema";

import { polar } from "~/app/initializers/billing";
import { features } from "~/app/initializers/flags";
import jobs from "~/app/jobs";
import { shouldNotifyFlowResult } from "~/app/services/alerts/dispatch";
import { writePingResult } from "~/app/services/analytics";
import { mapWithConcurrency } from "~/app/services/concurrency";
import { apportionCostByTeam } from "~/app/services/cost";
import { planFlowBilling, settleFlowBilling } from "~/app/services/flow-billing";
import { runFlowCheck } from "~/app/services/flow-check";
import { enqueueNotifications } from "~/app/services/notify-queue";

/** What one completed run produced, beyond the row it wrote. */
interface CheckedMonitor {
	/** The result row's id, which the meter's idempotency key is derived from. */
	resultId: string;
	/** The check outcome, which decides ping vs flow-run billing. */
	result: FlowCheckResult;
	/** The alert this run's outcome warrants, or `null` when it warrants none. */
	notification: NotifyMessage | null;
}

export default createJobHandler(jobs.checkFlows, async (ctx) => {
	let monitors = await ctx.models.flowMonitors.claimDue(Date.now());
	/**
	 * The sweep's fixed cost — the claim, the invocation, its share of the batch — split
	 * across the teams whose monitors it took, in proportion to how many it took from each.
	 * A delivery that claimed nothing is platform cost.
	 */
	apportionCostByTeam(monitors.map((monitor) => monitor.team_id));

	let teamIds = monitors.map((monitor) => monitor.team_id);
	/**
	 * Two queries for the whole sweep, run before the checks so nothing waits on
	 * them afterward: who to bill (the team's owner, the Polar customer) and what
	 * each team may reach, one read per sweep shared across every monitor.
	 */
	let [ownerIds, verifiedDomains] = await Promise.all([
		ctx.models.teams.ownerIdsByTeamIds(teamIds),
		ctx.models.teamDomains.verifiedHostnamesByTeam(teamIds),
	]);

	let notifications: NotifyMessage[] = [];
	let billingPlan: FlowBillingPlan = { pings: [], flowRuns: [], browserSeconds: 0 };
	let successCount = 0;
	let errorCount = 0;

	let concurrency = await ctx.flags.get(features.sweepConcurrency);
	let settled = await mapWithConcurrency(
		monitors,
		(monitor) => check(ctx.models, monitor, verifiedDomains.get(monitor.team_id) ?? []),
		concurrency,
	);

	for (let outcome of settled) {
		if (!outcome.ok) {
			errorCount++;
			ctx.log.warn("checks.monitor_failed", {
				"monitor.id": outcome.item.id,
				error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
			});
			continue;
		}

		successCount++;
		if (outcome.value.notification !== null) notifications.push(outcome.value.notification);

		let ownerId = ownerIds.get(outcome.item.team_id);
		/**
		 * A monitor whose team names no owner cannot be billed — there is no Polar
		 * customer to ingest against — but its run already happened and is
		 * recorded, so this logs the drop and lets the sweep continue.
		 */
		if (ownerId === undefined) {
			ctx.log.warn("checks.unbillable_team", {
				"monitor.id": outcome.item.id,
				"team.id": outcome.item.team_id,
			});
			continue;
		}

		let planned = planFlowBilling(outcome.value.result, {
			resultId: outcome.value.resultId,
			ownerId,
			teamId: outcome.item.team_id,
			monitorId: outcome.item.id,
		});
		billingPlan.pings.push(...planned.pings);
		billingPlan.flowRuns.push(...planned.flowRuns);
		billingPlan.browserSeconds += planned.browserSeconds;
	}

	await enqueueNotifications(notifications);
	/** One ingest per meter for the whole sweep, so twenty flows stay two subrequests. */
	await settleFlowBilling(polar, billingPlan);

	ctx.log.set({
		checks: {
			total: monitors.length,
			succeeded: successCount,
			failed: errorCount,
			notified: notifications.length,
			ingested: billingPlan.pings.length + billingPlan.flowRuns.length,
			flowRuns: billingPlan.flowRuns.length,
			pings: billingPlan.pings.length,
		},
	});
});

/**
 * Runs one monitor's spec and records its result, reading `last_status` before the
 * write so a recovery is detectable.
 */
async function check(
	models: UptimeModels,
	monitor: ClaimedFlowMonitor,
	verifiedDomains: readonly string[],
): Promise<CheckedMonitor> {
	/** The column is declared as a plain text enum, so its value set is asserted here. */
	let previousStatus = monitor.last_status as FlowStatus | null;
	let result = await runFlowCheck({ source: monitor.source, verifiedDomains });
	let resultId = await models.flowMonitors.recordCheckResult(monitor.id, result, {
		teamId: monitor.team_id,
	});

	/**
	 * One data point per run, not per request — the series is "how long does the
	 * flow take", not a request count. A run that never started reports zero
	 * duration, matching how the rest of the dataset spells "no measurement".
	 */
	writePingResult({
		monitorId: monitor.id,
		teamId: monitor.team_id,
		type: "flow",
		status: result.status,
		responseTimeMs: result.durationMs ?? 0,
	});

	if (!shouldNotifyFlowResult(previousStatus, result.status)) {
		return { resultId, result, notification: null };
	}

	/**
	 * Ids and statuses only, per the queue's contract: the consumer rebuilds the failing
	 * assertion from the result row this check just wrote, so a message read later
	 * quotes what was actually recorded.
	 */
	return {
		resultId,
		result,
		notification: {
			monitorType: "flow",
			monitorId: monitor.id,
			previousStatus,
			newStatus: result.status,
		},
	};
}
