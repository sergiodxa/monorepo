/**
 * The arithmetic every uptime report shares: folding many checks into one
 * status a summary prints, and turning a success ratio into the percentage
 * next to it. The verdict is always the worst of the checks, since averaging
 * an outage away would hide the one thing a reader could act on, and keeping
 * the rule here stops two reports of the same data from disagreeing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UptimeBar } from "~/app/emails/shared/uptime-bar";
import type { MonitorStatus } from "~/database/schema";

/** Severity of each status, for picking the one a period is reported as. */
const SEVERITY: Record<MonitorStatus, number> = { up: 0, degraded: 1, down: 2 };

/**
 * The worse of two statuses, where `null` means no check covered the
 * period. Any measured status outweighs no data: a period with even one
 * passing check counts as up, anchoring the report to what a reader can verify.
 *
 * @param current - What the period is reported as so far.
 * @param next - Another check's status to fold in.
 * @returns The status the period is reported as.
 * @example results.reduce((worst, result) => worstStatus(worst, result.status), null)
 */
export function worstStatus(current: UptimeBar.Status, next: UptimeBar.Status): UptimeBar.Status {
	if (current === null) return next;
	if (next === null) return current;
	return SEVERITY[next] > SEVERITY[current] ? next : current;
}

/**
 * A success ratio as the percentage a report prints, without its sign — the emails add that
 * themselves, since where the symbol goes is a property of the language.
 *
 * @param ratio - Healthy checks over total checks, between 0 and 1.
 * @returns The percentage to one decimal, e.g. `"99.4"`.
 */
export function formatUptime(ratio: number): string {
	return (ratio * 100).toFixed(1);
}
