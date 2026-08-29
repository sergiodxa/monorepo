/**
 * What every ad-hoc ping does regardless of who asked for it: record it to Analytics
 * Engine and bill it to the team. Two callers perform ad-hoc pings — the public
 * `POST /api/v1/ping` endpoint and the dashboard's quick-check form — and the check
 * itself differs between them (the API offers HTTP, DNS and TCP; the form offers only
 * HTTP), while everything that makes a check *billable* is identical. This is that part.
 *
 * A caller decides what to probe, whether a subscription allows it, and what to say
 * in response; this module owns only what the ping costs and where it is counted —
 * the half that must not drift between the two callers.
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
 * The `monitorId` an ad-hoc ping is recorded under in Analytics Engine. A shared synthetic
 * value: every ad-hoc ping is a one-off, so per-ping ids would make a high-cardinality
 * dimension nothing can group by, while this one counts a team's ad-hoc traffic as one stream.
 *
 * @see {@link recordAdhocPing} — the Polar event, which identifies the same ping by its own id.
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
 * Writes the data point synchronously and bills the team under `waitUntil`, since a
 * caller already holding its result must not wait on billing. The billed event's
 * metadata is team and type only, so it lands in the team's shared total.
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
