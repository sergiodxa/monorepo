/**
 * Decides how a completed flow check is billed: HTTP-only runs as one ping per request,
 * browser runs as one flow-run event plus browser-second cost. Shared by
 * the sweep and the manual check action so the two paths can never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@sdxc/billing";

import type { FlowCheckResult } from "~/app/services/flow-check";
import type { BillableFlowRun } from "~/app/services/flow-run-meter";
import type { BillablePing } from "~/app/services/ping-meter";

import { recordCost } from "~/app/services/cost";
import { ingestFlowRuns } from "~/app/services/flow-run-meter";
import { ingestPings } from "~/app/services/ping-meter";

/** What to ingest (and cost) for one recorded flow result. */
export interface FlowBillingPlan {
	/** Ping events for an HTTP-only run. Empty when the flow used the browser. */
	pings: BillablePing[];
	/** Flow-run events for a browser run. Empty when the flow stayed on HTTP. */
	flowRuns: BillableFlowRun[];
	/** Browser-seconds to put on the cost ledger. Zero when no session ran. */
	browserSeconds: number;
}

/** Identity of the monitor and billing subject a result belongs to. */
export interface FlowBillingSubject {
	resultId: string;
	ownerId: string;
	teamId: string;
	monitorId: string;
}

/**
 * Build the meter events and cost quantity for one flow result.
 *
 * A pre-start refusal (`error` with no measured duration) bills nothing on either meter.
 * A browser run that started bills exactly one flow-run event, never pings.
 */
export function planFlowBilling(
	result: FlowCheckResult,
	subject: FlowBillingSubject,
): FlowBillingPlan {
	if (result.usedBrowser) {
		if (result.durationMs === null) {
			return { pings: [], flowRuns: [], browserSeconds: 0 };
		}
		let durationSeconds = result.durationMs / 1000;
		return {
			pings: [],
			flowRuns: [
				{
					externalId: `flow_run:${subject.resultId}`,
					ownerId: subject.ownerId,
					teamId: subject.teamId,
					monitorId: subject.monitorId,
					durationSeconds,
				},
			],
			browserSeconds: durationSeconds,
		};
	}

	let pings: BillablePing[] = [];
	for (let index = 0; index < result.requestsMade; index++) {
		pings.push({
			externalId: `ping:${subject.resultId}:${index}`,
			ownerId: subject.ownerId,
			teamId: subject.teamId,
			monitorId: subject.monitorId,
			type: "flow",
		});
	}
	return { pings, flowRuns: [], browserSeconds: 0 };
}

/**
 * Ingest the plan's meter events and record browser-seconds on the cost ledger.
 * Meter failures are best-effort; the ledger write always happens for a browser run so
 * Cost Insights still sees what the session cost even when Polar ingestion is down.
 */
export async function settleFlowBilling(billing: Billing, plan: FlowBillingPlan): Promise<void> {
	if (plan.browserSeconds > 0) {
		recordCost("browserSecond", plan.browserSeconds);
	}
	await Promise.all([ingestPings(billing, plan.pings), ingestFlowRuns(billing, plan.flowRuns)]);
}
