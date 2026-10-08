/**
 * Classifies any expiry date, a certificate's or a domain registration's, as valid,
 * expiring or expired against a warning window, and decides which days warrant a reminder.
 * Both daily checks share it, so the two kinds of expiry alert on the same schedule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DAY_MS } from "@sdxc/dates/zone";

/** Days-until-expiry thresholds `shouldRemindOfExpiry` treats as reminder days. */
const WARNING_THRESHOLDS_DAYS = [30, 14, 7, 1];

/** Where a date sits relative to its warning window; `unknown` when there is no date. */
export type ExpiryStatus = "unknown" | "valid" | "expiring" | "expired";

/** A classification and the whole days left, negative once the date has passed. */
export interface ExpiryClassification {
	status: ExpiryStatus;
	daysUntilExpiry: number | null;
}

/**
 * Classifies an expiry date against a warning window, counting whole days from now.
 *
 * @param expiresAt Expiry as epoch milliseconds, or `null` when unknown.
 * @param warningDays Days before expiry the date counts as `expiring`.
 * @example classifyExpiry(Date.now() + 10 * DAY_MS, 30); // { status: "expiring", daysUntilExpiry: 9 }
 */
export function classifyExpiry(
	expiresAt: number | null,
	warningDays: number,
): ExpiryClassification {
	if (expiresAt === null) return { status: "unknown", daysUntilExpiry: null };

	let daysUntilExpiry = Math.floor((expiresAt - Date.now()) / DAY_MS);

	if (daysUntilExpiry < 0) return { status: "expired", daysUntilExpiry };
	if (daysUntilExpiry <= warningDays) return { status: "expiring", daysUntilExpiry };
	return { status: "valid", daysUntilExpiry };
}

/**
 * Whether today warrants a reminder. `expired` always does; `expiring` does every day
 * within {@link WARNING_THRESHOLDS_DAYS} of expiry, repeating daily until renewal, and
 * per-alert cooldown keeps the repetition bounded.
 */
export function shouldRemindOfExpiry(status: string, daysUntilExpiry: number | null): boolean {
	if (status === "expired") return true;
	if (status === "expiring" && daysUntilExpiry !== null) {
		return WARNING_THRESHOLDS_DAYS.some((threshold) => daysUntilExpiry <= threshold);
	}
	return false;
}
