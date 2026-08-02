/**
 * Background job that claims the TCP monitors whose configured `interval_seconds` has come
 * round and checks those, rather than sweeping every enabled monitor on a cadence of its
 * own (ADR-006). Attempts a raw TCP connection to each host:port, records the outcome via
 * `TcpMonitor.recordCheckResult`, and enqueues a `notify` message for a down/timeout result
 * or a recovery back to up.
 *
 * Delivered every minute, which is the finest interval a monitor can be configured with.
 * Running that often is cheaper than the old 5-minute full sweep, not more expensive: the
 * claim is an indexed range that matches nothing in most minutes, and it is also what stops
 * the several deliveries a single minute's cron produces from checking the same monitor
 * more than once.
 *
 * Monitors are checked in bounded-concurrency batches rather than one at a time, and
 * alerts are dispatched by the `notify` consumer rather than inline, so the sweep's wall
 * time is no longer the sum of every monitor's connection timeout plus every email send
 * it triggers (ADR-008).
 *
 * Every check the sweep completes is also a ping: it is metered against the team's
 * allowance and written to Analytics Engine, both after the fact and both for the checks
 * that finished. A connection attempt that threw left no result row, so it bills nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { PolarClient } from "@pkg/polar";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { ClaimedTcpMonitor } from "~/app/data/tcp-monitor";
import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { BillablePing } from "~/app/services/ping-meter";
import type { TcpCheckStatus } from "~/app/services/tcp-check";

import TcpMonitor from "~/app/data/tcp-monitor";
import Team from "~/app/data/team";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { shouldNotifyTcpResult } from "~/app/services/alerts";
import { writePingResult } from "~/app/services/analytics";
import { apportionCostByTeam } from "~/app/services/cost";
import { ingestPings } from "~/app/services/ping-meter";
import { checkTcpConnection } from "~/app/services/tcp-check";

/**
 * What one completed check produced, beyond the row it wrote: the alert its outcome
 * warrants, if any, and the id of the result row that alert-independent billing keys on.
 *
 * The two travel together because they have the same precondition — a check that ran to
 * completion — and separating them would mean either running the sweep's fan-out twice or
 * matching results back to monitors by index.
 */
interface CheckedMonitor {
	notification: NotifyMessage | null;
	resultId: string;
}

export class CheckTcpJob extends Job {
	/** The "Check TCP Connections" cron monitor this sweep reports itself to when it completes. */
	static override monitorId = "94276ec1-18f9-4dde-8a09-c5a00df29454";

	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let polar = getServiceContainer().get(PolarClient);
		/**
		 * Claimed as of now rather than as of the cron's `scheduledTime`: the claim advances
		 * each monitor from its own previous due time, so what this instant decides is only
		 * which monitors are owed a check, and the queue hop between the trigger and here is
		 * seconds. Nothing downstream keys off it, unlike the HTTP sweep's per-minute job id.
		 */
		let monitors = await TcpMonitor.claimDue(db, Date.now());
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
			db,
			monitors.map((monitor) => monitor.team_id),
		);

		let notifications: NotifyMessage[] = [];
		let pings: BillablePing[] = [];
		let successCount = 0;
		let errorCount = 0;

		let settled = await mapWithConcurrency(monitors, (monitor) => this.check(db, monitor));

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
					this.logger.error("job.check_tcp.unbillable_team", {
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
			this.logger.error("job.check_tcp.monitor_failed", {
				monitorId: outcome.item.id,
				error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
			});
		}

		await enqueueNotifications(notifications);
		/** Every ping in one call, so a sweep of eighty monitors costs one subrequest. */
		await ingestPings(polar, pings);

		this.logger.info("job.check_tcp.completed", {
			total: monitors.length,
			successCount,
			errorCount,
			notified: notifications.length,
			ingested: pings.length,
		});
	}

	/**
	 * Checks one monitor and records its result, returning what the sweep needs from a
	 * completed check: the notification its outcome warrants (`null` when it isn't
	 * alert-worthy) and the result row's id. The previous status is read before the write,
	 * since that's what makes a recovery detectable.
	 *
	 * Throwing here is what marks a monitor as failed, so everything this returns describes
	 * a check that finished — which is why the caller can bill for it unconditionally.
	 */
	private async check(db: Database, monitor: ClaimedTcpMonitor): Promise<CheckedMonitor> {
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
				type: "notify",
				monitorType: "tcp",
				monitorId: monitor.id,
				previousStatus,
				newStatus: result.status,
			},
			resultId,
		};
	}
}
