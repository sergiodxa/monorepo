/**
 * The billable side of a ping: what Polar's metered `ping` meter is, and the one way
 * events reach it. Every check this app performs — a scheduled HTTP, DNS or TCP check, a
 * cron-job ping it receives, an ad-hoc `POST /api/v1/ping` — is one ping against the
 * allowance `app/lib/pricing.ts` describes, and each one ingests exactly one event here.
 *
 * The meter id and the event name live together on purpose: for a long time the meter was
 * queried while nothing fed it, so every team's usage read zero and metered usage was
 * never charged. Keeping "what the meter is" next to "what fills it" is what makes that
 * state visible in one file instead of inferable from its absence in several.
 *
 * One event per ping, unlike `app/jobs/report-costs.ts`, which deliberately rolls
 * infrastructure cost up to one event per team per day. Cost is a figure nobody reads
 * before tomorrow; usage is what a customer checks against their allowance mid-month, so
 * it is ingested as it happens. What keeps the volume affordable is that callers producing
 * many pings at once hand them over in one call — see {@link ingestPings}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IngestEvent, PolarClient } from "@pkg/polar";

import { logger } from "@pkg/logger";

import type { PingType } from "~/app/services/analytics";

/**
 * The Polar meter tracking ingested `ping` usage events, and the meter the customer's
 * metered charge is computed from.
 */
export const PING_METER_ID = "22fabd9b-8b03-4cc2-8981-230717267cd5";

/**
 * The Polar event name the meter counts. Changing it silently stops every ping from being
 * billed, since the meter matches on the name and an unmatched event is simply stored.
 */
export const PING_EVENT_NAME = "ping";

/** One performed ping, as the thing to bill a team for. */
export interface BillablePing {
	/**
	 * A stable, unique id for this ping. Polar deduplicates on it, which is what makes a
	 * redelivered queue message or a re-run reporting pass free rather than double-billed.
	 * Derive it from something already unique to the check — the job id a result row is
	 * keyed on, the result row's own id — never from the clock or a fresh random value.
	 */
	externalId: string;
	/** The team owner's subject id, which is the Polar customer's external id. */
	ownerId: string;
	/** The team the ping is billed to; read back as the `teamId` meter filter. */
	teamId: string;
	/** The monitor that caused it, or `null` for an ad-hoc ping that has no monitor. */
	monitorId: string | null;
	type: PingType;
}

/**
 * Ingests one event per ping into the `ping` meter.
 *
 * Best-effort by design: a Polar outage must never fail a monitoring check or reject an
 * API request, so this returns `false` instead of throwing and the caller carries on. The
 * cost of that is real and worth stating — a dropped event is revenue that nothing
 * retries, and `ping_meter.ingest_failed` is the only trace it leaves.
 *
 * Pass every ping a unit of work produced in one call rather than looping: the client
 * chunks them into as few requests as Polar accepts, so a sweep that checked eighty
 * monitors costs one subrequest instead of eighty.
 *
 * The metadata keys are load-bearing rather than decorative. Nothing in this app reads the
 * meter back any more — the usage cards count checks from local history — but the meter is
 * still what the customer is billed from, and `teamId`/`monitorId` are what make a charge
 * attributable to a team and a monitor when a bill is disputed or inspected in Polar. A
 * missing key doesn't lose the event, it makes that event impossible to account for. An
 * ad-hoc ping deliberately carries no `monitorId`: it is billed to its team and belongs to
 * no monitor.
 *
 * @param polar The billing client.
 * @param pings The pings to bill. An empty array is a no-op and makes no request.
 * @returns `true` when every event was accepted, `false` when ingestion failed.
 */
export async function ingestPings(polar: PolarClient, pings: BillablePing[]): Promise<boolean> {
	if (pings.length === 0) return true;

	let events: IngestEvent[] = pings.map((ping) => ({
		name: PING_EVENT_NAME,
		externalCustomerId: ping.ownerId,
		externalId: ping.externalId,
		metadata: {
			teamId: ping.teamId,
			type: ping.type,
			...(ping.monitorId === null ? {} : { monitorId: ping.monitorId }),
		},
	}));

	if (await polar.ingestEventsSafe(events)) return true;

	logger.error("ping_meter.ingest_failed", {
		count: pings.length,
		teamIds: [...new Set(pings.map((ping) => ping.teamId))],
		types: [...new Set(pings.map((ping) => ping.type))],
	});
	return false;
}
