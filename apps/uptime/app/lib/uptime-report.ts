/**
 * The two pieces of arithmetic every uptime report shares, whichever window it covers and
 * whoever reads it: how a set of checks collapses into the one status a summary can print,
 * and how a success ratio becomes the percentage next to it.
 *
 * They live together because they are the same decision seen twice. A bar segment, a
 * monitor's day and a monitor's week are all "many checks, one verdict", and the verdict is
 * always the worst of them — a summary that averaged an outage away would hide the only
 * thing in it a reader could act on. Keeping the rule in one place is what stops two reports
 * of the same data disagreeing.
 *
 * Deliberately not in `~/app/emails/`: nothing here renders, and its callers are assembling
 * data before an email class ever exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UptimeBar } from "~/app/emails/shared/uptime-bar";
import type { MonitorStatus } from "~/database/schema";

/** Severity of each status, for picking the one a period is reported as. */
const SEVERITY: Record<MonitorStatus, number> = { up: 0, degraded: 1, down: 2 };

/**
 * The worse of two statuses, where `null` means no check covered the period.
 *
 * No-data loses to anything measured rather than winning as the least known state: a period
 * with one check that passed was up, and reporting it as unknown because most of it was
 * unobserved would understate a record the reader can verify.
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
