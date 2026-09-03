/**
 * The billable side of a ping: the one path a performed check takes to the meter it is
 * counted against. Every check this app performs is one ping against a team's allowance,
 * ingested as it happens so a customer's usage stays current mid-month.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, UsageEvent } from "@sdxc/billing";

import { supports } from "@sdxc/billing";
import { logger } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";

import type { PingType } from "~/app/services/analytics";

import { PING_METER } from "~/app/lib/billing";

/** One performed ping, as the thing to bill a team for. */
export interface BillablePing {
	/**
	 * A stable, unique id for this ping. The platform deduplicates on it, so a redelivered
	 * queue message or a re-run reporting pass costs nothing extra. Derive it from something
	 * already unique to the check, such as the job id a result row is keyed on.
	 */
	externalId: string;
	/** The team owner's subject id, which is the billing customer's external id. */
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
 * Counts one event per ping against the ping meter, batching a whole call's pings into one
 * request. A billing outage must never fail the check that produced the ping: failures log
 * `ping_meter.ingest_failed` and answer `false` so the caller can continue.
 *
 * @param billing - The configured platform.
 * @param pings - The pings to bill. An empty array is a no-op and makes no request.
 * @returns `true` when every event was accepted, `false` when ingestion failed.
 */
export async function ingestPings(billing: Billing, pings: BillablePing[]): Promise<boolean> {
	if (pings.length === 0) return true;

	if (!supports(billing, "usage")) {
		logger.error("ping_meter.usage_unsupported", { connection: billing.connection });
		return false;
	}

	let events: UsageEvent[] = pings.map((ping) => ({
		name: PING_METER,
		customer: { externalId: ping.ownerId },
		externalId: ping.externalId,
		metadata: {
			teamId: ping.teamId,
			type: ping.type,
			...(ping.monitorId === null ? {} : { monitorId: ping.monitorId }),
		},
	}));

	let ingested = await billing.usage.ingest(events);
	if (!isFailure(ingested)) return true;

	logger.error("ping_meter.ingest_failed", {
		code: ingested.error.code,
		providerCode: ingested.error.providerCode,
		count: pings.length,
		teamIds: [...new Set(pings.map((ping) => ping.teamId))],
		types: [...new Set(pings.map((ping) => ping.type))],
	});

	return false;
}
