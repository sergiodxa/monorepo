/**
 * Claims the flow monitors whose interval has come round via an indexed
 * range and runs each through `runFlowCheck` (ADR-006). Delivered every
 * minute despite intervals as coarse as fifteen (ADR-027 §7a) so the
 * trigger list stays flat as monitor types grow. Verified domains are team
 * state, read fresh each sweep since they are not stored on the monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createJobHandler } from "@pkg/jobs-next";
import { PolarClient } from "@pkg/polar";
import { getServiceContainer } from "@pkg/service-container";

import type { ClaimedFlowMonitor } from "~/app/data/flow-monitor";
import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { BillablePing } from "~/app/services/ping-meter";
import type { FlowStatus } from "~/database/schema";

import FlowMonitor from "~/app/data/flow-monitor";
import Team from "~/app/data/team";
import TeamDomain from "~/app/data/team-domain";
import jobs from "~/app/jobs";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { shouldNotifyFlowResult } from "~/app/services/alerts";
import { writePingResult } from "~/app/services/analytics";
import { apportionCostByTeam } from "~/app/services/cost";
import { runFlowCheck } from "~/app/services/flow-check";
import { ingestPings } from "~/app/services/ping-meter";

/** What one completed run produced, beyond the row it wrote. */
interface CheckedMonitor {
	/** The result row's id, which the ping meter's idempotency key is derived from. */
	resultId: string;
	/** HTTP requests the run made, and therefore how many pings it bills. */
	requestsMade: number;
	/** The alert this run's outcome warrants, or `null` when it warrants none. */
	notification: NotifyMessage | null;
}

export default createJobHandler(jobs.checkFlows, async (ctx) => {
	let polar = getServiceContainer().get(PolarClient);

	let monitors = await FlowMonitor.claimDue(ctx.database, Date.now());
	/**
	 * The sweep's fixed cost — the claim, the invocation, its share of the batch — split
	 * across the teams whose monitors it took, in proportion to how many it took from each
	 * (ADR-007 §5). A delivery that claimed nothing is platform cost.
	 */
	apportionCostByTeam(monitors.map((monitor) => monitor.team_id));

	let teamIds = monitors.map((monitor) => monitor.team_id);
	/**
	 * Two queries for the whole sweep, run before the checks so nothing waits on
	 * them afterward: who to bill (the team's owner, the Polar customer) and what
	 * each team may reach, one read per sweep shared across every monitor.
	 */
	let [ownerIds, verifiedDomains] = await Promise.all([
		Team.ownerIdsByTeamIds(ctx.database, teamIds),
		TeamDomain.verifiedHostnamesByTeamIds(ctx.database, teamIds),
	]);

	let notifications: NotifyMessage[] = [];
	let pings: BillablePing[] = [];
	let successCount = 0;
	let errorCount = 0;

	let settled = await mapWithConcurrency(monitors, (monitor) =>
		check(ctx.database, monitor, verifiedDomains.get(monitor.team_id) ?? []),
	);

	for (let outcome of settled) {
		if (!outcome.ok) {
			errorCount++;
			ctx.logger.error("job.check_flows.monitor_failed", {
				monitorId: outcome.item.id,
				error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
			});
			continue;
		}

		successCount++;
		if (outcome.value.notification !== null) notifications.push(outcome.value.notification);

		/** A run that sent nothing bills nothing, so there is no event to derive. */
		if (outcome.value.requestsMade === 0) continue;

		let ownerId = ownerIds.get(outcome.item.team_id);
		/**
		 * A monitor whose team names no owner cannot be billed — there is no Polar
		 * customer to ingest against — but its run already happened and is
		 * recorded, so this logs the drop and lets the sweep continue.
		 */
		if (ownerId === undefined) {
			ctx.logger.error("job.check_flows.unbillable_team", {
				monitorId: outcome.item.id,
				teamId: outcome.item.team_id,
			});
			continue;
		}

		for (let index = 0; index < outcome.value.requestsMade; index++) {
			pings.push({
				/**
				 * The result row's id plus the request's ordinal. Both halves are needed: the row
				 * id is what makes a redelivered sweep free rather than double-billed, and the
				 * ordinal is what keeps one run's several requests from deduplicating into one.
				 */
				externalId: `ping:${outcome.value.resultId}:${index}`,
				ownerId,
				teamId: outcome.item.team_id,
				monitorId: outcome.item.id,
				type: "flow",
			});
		}
	}

	await enqueueNotifications(notifications);
	/** Every ping in one call, so a sweep of twenty flows costs one subrequest. */
	await ingestPings(polar, pings);

	ctx.logger.info("job.check_flows.completed", {
		total: monitors.length,
		successCount,
		errorCount,
		notified: notifications.length,
		ingested: pings.length,
	});
});

/**
 * Runs one monitor's spec and records its result, reading `last_status` before the
 * write so a recovery is detectable. Throwing here marks the monitor failed, so
 * callers bill unconditionally — `runFlowCheck` never throws, resolving bad specs or
 * unverified hosts to an `error` result instead.
 */
async function check(
	db: Database,
	monitor: ClaimedFlowMonitor,
	verifiedDomains: readonly string[],
): Promise<CheckedMonitor> {
	/** The column is declared as a plain text enum, so its value set is asserted here. */
	let previousStatus = monitor.last_status as FlowStatus | null;
	let result = await runFlowCheck({ source: monitor.source, verifiedDomains });
	let resultId = await FlowMonitor.recordCheckResult(db, monitor.id, result);

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

	if (!shouldNotifyFlowResult(previousStatus, result.status))
		return { resultId, requestsMade: result.requestsMade, notification: null };

	/**
	 * Ids and statuses only, per the queue's contract: the consumer rebuilds the failing
	 * assertion from the result row this check just wrote, so a message read later
	 * quotes what was actually recorded.
	 */
	return {
		resultId,
		requestsMade: result.requestsMade,
		notification: {
			monitorType: "flow",
			monitorId: monitor.id,
			previousStatus,
			newStatus: result.status,
		},
	};
}
