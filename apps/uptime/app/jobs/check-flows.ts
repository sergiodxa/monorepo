/**
 * Background job that claims the flow monitors whose configured `interval_seconds` has come
 * round and runs those, rather than sweeping every enabled monitor on a cadence of its own
 * (ADR-006). Each run executes the monitor's spec through `runFlowCheck`, records the outcome
 * via `FlowMonitor.recordCheckResult`, and meters what it spent.
 *
 * Delivered every minute like the other sweeps, even though the finest flow interval is
 * fifteen minutes (ADR-027 §7a): the claim is an indexed range that matches nothing in most
 * minutes, and sharing the every-minute delivery is what keeps the trigger list from growing a
 * line per monitor type.
 *
 * What a flow may reach is decided here and not by the spec. Verified domains are team state,
 * so they are read per sweep rather than stored on the monitor — a domain un-verified this
 * morning stops this afternoon's check, with no monitor to re-save. A team with none can run
 * nothing, which is recorded as an `error` result rather than skipped silently: a monitor that
 * quietly stops checking is the failure mode this whole app exists to prevent.
 *
 * A flow run is metered as **one ping per HTTP request it made**, which is what it costs and
 * what it is — several pings with assertions between them. Requests that never happened bill
 * nothing, so a run refused before it started is free.
 *
 * Alerting is deliberately not wired yet: a notification needs a dashboard URL to link to, and
 * flow monitors have no pages. Results are recorded and visible to whatever reads them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { PolarClient } from "@pkg/polar";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { ClaimedFlowMonitor } from "~/app/data/flow-monitor";
import type { BillablePing } from "~/app/services/ping-meter";

import FlowMonitor from "~/app/data/flow-monitor";
import Team from "~/app/data/team";
import TeamDomain from "~/app/data/team-domain";
import { mapWithConcurrency } from "~/app/lib/concurrency";
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
}

export class CheckFlowsJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let polar = getServiceContainer().get(PolarClient);

		let monitors = await FlowMonitor.claimDue(db, Date.now());
		/**
		 * The sweep's fixed cost — the claim, the invocation, its share of the batch — split
		 * across the teams whose monitors it took, in proportion to how many it took from each
		 * (ADR-007 §5). A delivery that claimed nothing is platform cost.
		 */
		apportionCostByTeam(monitors.map((monitor) => monitor.team_id));

		let teamIds = monitors.map((monitor) => monitor.team_id);
		/**
		 * Two queries for the whole sweep, both before the runs so nothing waits on them
		 * afterwards: who to bill (a ping is billed to the team's owner, who is the Polar
		 * customer) and what each team is allowed to reach. Per monitor, either would be a D1
		 * read on every check in the batch.
		 */
		let [ownerIds, verifiedDomains] = await Promise.all([
			Team.ownerIdsByTeamIds(db, teamIds),
			TeamDomain.verifiedHostnamesByTeamIds(db, teamIds),
		]);

		let pings: BillablePing[] = [];
		let successCount = 0;
		let errorCount = 0;

		let settled = await mapWithConcurrency(monitors, (monitor) =>
			this.check(db, monitor, verifiedDomains.get(monitor.team_id) ?? []),
		);

		for (let outcome of settled) {
			if (!outcome.ok) {
				errorCount++;
				this.logger.error("job.check_flows.monitor_failed", {
					monitorId: outcome.item.id,
					error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
				});
				continue;
			}

			successCount++;
			/** A run that sent nothing bills nothing, so there is no event to derive. */
			if (outcome.value.requestsMade === 0) continue;

			let ownerId = ownerIds.get(outcome.item.team_id);
			/**
			 * A monitor whose team names no owner cannot be billed — there is no Polar customer to
			 * ingest against — but its run already happened and is recorded, so this drops the
			 * events and says so rather than failing the sweep.
			 */
			if (ownerId === undefined) {
				this.logger.error("job.check_flows.unbillable_team", {
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

		/** Every ping in one call, so a sweep of twenty flows costs one subrequest. */
		await ingestPings(polar, pings);

		this.logger.info("job.check_flows.completed", {
			total: monitors.length,
			successCount,
			errorCount,
			ingested: pings.length,
		});
	}

	/**
	 * Runs one monitor's spec and records its result.
	 *
	 * Throwing here is what marks a monitor as failed, so everything this returns describes a
	 * run that finished — which is why the caller can bill for it unconditionally. `runFlowCheck`
	 * itself never throws: a spec that will not parse or a host the team has not verified is an
	 * `error` result, recorded like any other.
	 */
	private async check(
		db: Database,
		monitor: ClaimedFlowMonitor,
		verifiedDomains: readonly string[],
	): Promise<CheckedMonitor> {
		let result = await runFlowCheck({ source: monitor.source, verifiedDomains });
		let resultId = await FlowMonitor.recordCheckResult(db, monitor.id, result);

		/**
		 * One data point per run, not per request: the series this feeds is "how long does the
		 * flow take", and a point per request would turn a latency chart into a request-count
		 * chart. A run that never started has no duration to report, and zero is how the rest of
		 * the dataset already spells "no measurement".
		 */
		writePingResult({
			monitorId: monitor.id,
			teamId: monitor.team_id,
			type: "flow",
			status: result.status,
			responseTimeMs: result.durationMs ?? 0,
		});

		return { resultId, requestsMade: result.requestsMade };
	}
}
