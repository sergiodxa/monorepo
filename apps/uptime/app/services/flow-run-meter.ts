/**
 * The billable side of a browser flow run: one Polar event per run on the flow-run
 * meter. HTTP-only flows stay on {@link ingestPings}; this path is only
 * for specs that opened a Browser Run session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, UsageEvent } from "@sdxc/billing";

import { supports } from "@sdxc/billing";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";

import { FLOW_RUN_METER } from "~/app/initializers/billing";

/** One performed browser flow run, as the thing to bill a team for. */
export interface BillableFlowRun {
	/**
	 * A stable, unique id for this run. The platform deduplicates on it, so a redelivered
	 * sweep is free rather than double-billed. Derive it from the result row id.
	 */
	externalId: string;
	/** The team owner's subject id, which is the billing customer's external id. */
	ownerId: string;
	/** The team the run is billed to; read back as the `teamId` meter filter. */
	teamId: string;
	/** The flow monitor that caused it. */
	monitorId: string;
	/** Wall-clock seconds the Browser Run session was open, for cost attribution. */
	durationSeconds: number;
}

/**
 * Counts one event per browser flow run against the flow-run meter. A billing outage must
 * never fail the check that produced the run: failures warn `flow_runs.ingest_failed` and
 * answer `false` so the caller can continue.
 *
 * @param billing - The configured platform.
 * @param runs - The runs to bill. An empty array is a no-op and makes no request.
 * @returns `true` when every event was accepted, `false` when ingestion failed.
 */
export async function ingestFlowRuns(billing: Billing, runs: BillableFlowRun[]): Promise<boolean> {
	if (runs.length === 0) return true;

	if (!supports(billing, "usage")) {
		currentLog()?.warn("flow_runs.usage_unsupported", { connection: billing.connection });
		return false;
	}

	let events: UsageEvent[] = runs.map((run) => ({
		name: FLOW_RUN_METER,
		customer: { externalId: run.ownerId },
		externalId: run.externalId,
		metadata: {
			teamId: run.teamId,
			monitorId: run.monitorId,
			type: "flow",
			durationSeconds: run.durationSeconds,
		},
	}));

	let ingested = await billing.usage.ingest(events);
	if (!isFailure(ingested)) return true;

	currentLog()?.warn("flow_runs.ingest_failed", {
		code: ingested.error.code,
		providerCode: ingested.error.providerCode,
		count: runs.length,
		teams: new Set(runs.map((run) => run.teamId)).size,
	});

	return false;
}
