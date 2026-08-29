/**
 * Pure status-derivation helpers for the public status page: mapping each monitor
 * type's own status representation onto the shared `ServiceStatus` scale, and
 * combining every attached item's status into one page-level status via a majority
 * rule — down/degraded items outnumbering healthy ones tips the page to "down"; any
 * at all tips it to "degraded".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MonitorHealth } from "~/app/services/analytics";
import type { CronJobStatus } from "~/database/schema";

/** A single service's derived state, shared by HTTP/DNS/TCP/cron-job items. */
export type ServiceStatus = "operational" | "degraded" | "down" | "unknown";

/** Maps an HTTP monitor's 24h health badge onto the shared status scale. */
export function deriveHttpStatus(health: MonitorHealth): ServiceStatus {
	if (health === "up") return "operational";
	if (health === "degraded") return "degraded";
	if (health === "down") return "down";
	return "unknown";
}

/** Maps a DNS monitor's cached last-check status onto the shared status scale. */
export function deriveDnsStatus(lastStatus: string | null): ServiceStatus {
	if (lastStatus === "ok") return "operational";
	if (lastStatus === "changed") return "degraded";
	if (lastStatus === "error") return "down";
	return "unknown";
}

/** Maps a TCP monitor's cached last-check status onto the shared status scale. */
export function deriveTcpStatus(lastStatus: string | null): ServiceStatus {
	if (lastStatus === "up") return "operational";
	if (lastStatus === "timeout") return "degraded";
	if (lastStatus === "down") return "down";
	return "unknown";
}

/** Maps a cron-job monitor's healthy/late/missed/new status onto the shared status scale. */
export function deriveCronStatus(status: CronJobStatus): ServiceStatus {
	if (status === "healthy") return "operational";
	if (status === "late") return "degraded";
	if (status === "missed") return "down";
	return "unknown";
}

/**
 * Combines every attached item's status into one page-level status. An empty list
 * (or a list where every item is still `"unknown"`) reads as `"operational"`, the
 * default for a status page with nothing attached to it yet.
 */
export function computeOverallStatus(statuses: ServiceStatus[]): ServiceStatus {
	let relevant = statuses.filter((status) => status !== "unknown");
	if (relevant.length === 0) return "operational";

	let notOperationalCount = relevant.filter(
		(status) => status === "down" || status === "degraded",
	).length;

	if (notOperationalCount > relevant.length / 2) return "down";
	if (notOperationalCount > 0) return "degraded";
	return "operational";
}
