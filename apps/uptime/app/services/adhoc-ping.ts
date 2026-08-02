/**
 * What every ad-hoc ping does regardless of who asked for it: record it to Analytics
 * Engine and bill it to the team. Two callers perform ad-hoc pings — the public
 * `POST /api/v1/ping` endpoint and the dashboard's quick-check form — and the check
 * itself differs between them (the API offers HTTP, DNS and TCP; the form offers only
 * HTTP), while everything that makes a check *billable* is identical. This is that part.
 *
 * It deliberately does not run the check, gate on a subscription, or shape a response.
 * A caller decides what to probe and what to say about it; this decides what the ping
 * costs and where it is counted, which is the half that must not drift between the two.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PolarClient } from "@pkg/polar";
import { getServiceContainer } from "@pkg/service-container";
import { waitUntil } from "cloudflare:workers";

import type { PingStatus } from "~/app/services/analytics";

import { writePingResult } from "~/app/services/analytics";
import { ingestPings } from "~/app/services/ping-meter";

/**
 * The `monitorId` an ad-hoc ping is recorded under in Analytics Engine. A synthetic
 * constant rather than the ping's own id: every ad-hoc ping is a one-off, so per-ping
 * blobs would make a high-cardinality dimension nothing can group by, while one shared
 * value lets a team's ad-hoc traffic be counted as the single stream it is. The Polar
 * event carries no monitor id at all — see {@link recordAdhocPing}.
 */
export const ADHOC_MONITOR_ID = "adhoc";

/** One performed ad-hoc ping, as the thing to record and bill. */
export interface AdhocPing {
	/** Unique id for this ping; becomes the meter event's idempotency key. */
	id: string;
	/** The team that asked for it, and whose owner is the Polar customer. */
	team: { id: string; owner_id: string };
	status: PingStatus;
	responseTimeMs: number;
}

/**
 * Writes the ping's data point and bills the team for it.
 *
 * Returns synchronously: the data point is fire-and-forget by nature, and the Polar
 * event goes out under `waitUntil` rather than being awaited, because both callers are
 * holding a connection open for a result they already have and neither should wait on
 * billing to hand it over. Ingestion is best-effort and logs its own failures.
 *
 * The event carries no `monitorId` because there is no monitor. That is what makes an
 * ad-hoc ping count toward its team's monthly total while appearing on no monitor's
 * usage card — the two cards filter the meter by different metadata keys.
 */
export function recordAdhocPing(ping: AdhocPing): void {
	writePingResult({
		monitorId: ADHOC_MONITOR_ID,
		teamId: ping.team.id,
		type: "adhoc",
		status: ping.status,
		responseTimeMs: ping.responseTimeMs,
	});

	waitUntil(
		ingestPings(getServiceContainer().get(PolarClient), [
			{
				externalId: `ping:${ping.id}`,
				ownerId: ping.team.owner_id,
				teamId: ping.team.id,
				monitorId: null,
				type: "adhoc",
			},
		]),
	);
}
