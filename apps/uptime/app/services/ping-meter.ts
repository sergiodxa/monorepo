/**
 * The billable side of a ping: what Polar's metered `ping` meter is, and the one path
 * events reach it. Every check this app performs is one ping against a team's allowance,
 * ingested as it happens so a customer's usage stays current mid-month. The meter id and
 * event name live together here since a past mismatch between them once left every
 * team's usage silently reading zero.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IngestEvent, PolarClient } from "@pkg/polar";

import { logger } from "@pkg/logger";

import type { PingType } from "~/app/services/analytics";

/**
 * The Polar meter tracking ingested `ping` usage events, and the meter the customer's
 * metered charge is computed from. Pinned to the id in Polar, so a typo here surfaces as
 * a team with zero usage.
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
	 * A stable, unique id for this ping. Polar deduplicates on it, so a redelivered queue
	 * message or a re-run reporting pass costs nothing extra. Derive it from something
	 * already unique to the check, such as the job id a result row is keyed on.
	 */
	externalId: string;
	/** The team owner's subject id, which is the Polar customer's external id. */
	ownerId: string;
	/** The team the ping is billed to; read back as the `teamId` meter filter. */
	teamId: string;
	/**
	 * The monitor that caused it, or `null` for an ad-hoc ping that has no monitor. Billed
	 * metadata omits this key entirely for an ad-hoc ping, keeping a `monitorId` filter
	 * looking at true absence.
	 */
	monitorId: string | null;
	type: PingType;
}

/**
 * Ingests one event per ping into the `ping` meter, batching a whole call's pings into
 * one request. A Polar outage must never fail the check that produced the ping: failures
 * log `ping_meter.ingest_failed` and return `false` so the caller can continue.
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
