/**
 * Background job that claims the TCP monitors whose `interval_seconds` has come round,
 * checks each via a raw TCP connection, and enqueues a `notify` message on a down/timeout
 * result or a recovery back to up (ADR-006). Runs every minute; the batch's cost is
 * apportioned by team and billed only for checks that completed (ADR-007, ADR-008).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createJobHandler } from "@pkg/jobs";
import { PolarClient } from "@pkg/polar";
import { getServiceContainer } from "@pkg/service-container";

import type { ClaimedTcpMonitor } from "~/app/data/tcp-monitor";
import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { BillablePing } from "~/app/services/ping-meter";
import type { TcpCheckStatus } from "~/app/services/tcp-check";

import TcpMonitor from "~/app/data/tcp-monitor";
import Team from "~/app/data/team";
import jobs from "~/app/jobs";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { shouldNotifyTcpResult } from "~/app/services/alerts";
import { writePingResult } from "~/app/services/analytics";
import { apportionCostByTeam } from "~/app/services/cost";
import { ingestPings } from "~/app/services/ping-meter";
import { checkTcpConnection } from "~/app/services/tcp-check";

/**
 * What one completed check produced, beyond the row it wrote: the alert its outcome
 * warrants (or `null`) and the result row's id. Both share one precondition — a check
 * that ran to completion — so returning both avoids a second pass over the sweep.
 */
interface CheckedMonitor {
	notification: NotifyMessage | null;
	resultId: string;
}

export default createJobHandler(jobs.checkTcp, async (ctx) => {
	let polar = getServiceContainer().get(PolarClient);
	/**
	 * Claimed as of now rather than the cron's `scheduledTime`: the claim advances each
	 * monitor from its own previous due time, so this instant only decides which monitors
	 * are owed a check, tolerating the seconds of queue hop between trigger and execution.
	 */
	let monitors = await TcpMonitor.claimDue(ctx.database, Date.now());
	/**
	 * The sweep's fixed cost — the claim, the invocation, its share of the batch — is
	 * split across the teams whose monitors it took, in proportion to how many it took
	 * from each (ADR-007 §5). A delivery that claimed nothing is platform cost.
	 */
	apportionCostByTeam(monitors.map((monitor) => monitor.team_id));

	/**
	 * One query for the whole sweep, run before the checks so nothing waits on it
	 * afterwards: a ping is billed to the team's owner, who is the Polar customer, and
	 * looking that up per monitor would put a D1 read on every check in the batch.
	 */
	let ownerIds = await Team.ownerIdsByTeamIds(
		ctx.database,
		monitors.map((monitor) => monitor.team_id),
	);

	let notifications: NotifyMessage[] = [];
	let pings: BillablePing[] = [];
	let successCount = 0;
	let errorCount = 0;

	let settled = await mapWithConcurrency(monitors, (monitor) => check(ctx.database, monitor));

	for (let outcome of settled) {
		if (outcome.ok) {
			successCount++;
			if (outcome.value.notification !== null) notifications.push(outcome.value.notification);

			let ownerId = ownerIds.get(outcome.item.team_id);
			/**
			 * A monitor whose team names no owner cannot be billed — there is no Polar
			 * customer to ingest against — but its check already ran and is recorded, so
			 * this drops the event and says so rather than failing the sweep.
			 */
			if (ownerId === undefined) {
				ctx.logger.error("job.check_tcp.unbillable_team", {
					monitorId: outcome.item.id,
					teamId: outcome.item.team_id,
				});
				continue;
			}

			pings.push({
				externalId: `ping:${outcome.value.resultId}`,
				ownerId,
				teamId: outcome.item.team_id,
				monitorId: outcome.item.id,
				type: "tcp",
			});
			continue;
		}

		errorCount++;
		ctx.logger.error("job.check_tcp.monitor_failed", {
			monitorId: outcome.item.id,
			error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
		});
	}

	await enqueueNotifications(notifications);
	/** Every ping in one call, so a sweep of eighty monitors costs one subrequest. */
	await ingestPings(polar, pings);

	ctx.logger.info("job.check_tcp.completed", {
		total: monitors.length,
		successCount,
		errorCount,
		notified: notifications.length,
		ingested: pings.length,
	});
});

/**
 * Checks one monitor and records its result. The previous status is read before the
 * write since that's what makes a recovery detectable, and throwing here is what marks
 * the monitor failed, so everything this returns describes a check that finished.
 */
async function check(db: Database, monitor: ClaimedTcpMonitor): Promise<CheckedMonitor> {
	/** The column is declared as a plain text enum, so its value set is asserted here. */
	let previousStatus = monitor.last_status as TcpCheckStatus | null;
	let result = await checkTcpConnection(monitor.host, monitor.port, monitor.timeout_ms);

	let resultId = await TcpMonitor.recordCheckResult(db, monitor.id, result);

	/**
	 * A refused or timed-out connection has no latency to report and the column is
	 * nullable for exactly that, but the dataset's doubles are not — zero is how the
	 * rest of the dataset already spells "no measurement", so it is what goes in.
	 */
	writePingResult({
		monitorId: monitor.id,
		teamId: monitor.team_id,
		type: "tcp",
		status: result.status,
		responseTimeMs: result.responseTimeMs ?? 0,
	});

	if (!shouldNotifyTcpResult(previousStatus, result.status)) {
		return { notification: null, resultId };
	}

	return {
		notification: {
			monitorType: "tcp",
			monitorId: monitor.id,
			previousStatus,
			newStatus: result.status,
		},
		resultId,
	};
}
