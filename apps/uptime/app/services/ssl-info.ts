/**
 * SSL certificate status calculation. Workers cannot read TLS certificate details from
 * `fetch()`, so this works from a manually entered expiry date to classify the
 * certificate as valid, expiring, or expired against the monitor's warning threshold.
 * The automated daily `CheckSslJob` (`app/jobs/check-ssl.ts`) reuses this same
 * classification, re-evaluating it once a day so status transitions (and alerts) fire
 * without the user having to revisit the settings form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SelectMonitor } from "~/database/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days-until-expiry thresholds `shouldAlertOnSslStatus` treats as alert-worthy. */
const WARNING_THRESHOLDS_DAYS = [30, 14, 7, 1];

/** SSL status enum values, matching `monitors.ssl_status`. */
export type SslStatus = NonNullable<SelectMonitor["ssl_status"]>;

/**
 * Classifies a certificate's status from its expiry date and warning threshold.
 *
 * @param expiresAt Certificate expiry, as epoch milliseconds, or `null` when unknown.
 * @param warningDays Days before expiry the certificate is considered "expiring".
 */
export function calculateSslStatus(
	expiresAt: number | null,
	warningDays: number,
): { status: SslStatus; daysUntilExpiry: number | null } {
	if (expiresAt === null) return { status: "unknown", daysUntilExpiry: null };

	let daysUntilExpiry = Math.floor((expiresAt - Date.now()) / MS_PER_DAY);

	if (daysUntilExpiry < 0) return { status: "expired", daysUntilExpiry };
	if (daysUntilExpiry <= warningDays) return { status: "expiring", daysUntilExpiry };
	return { status: "valid", daysUntilExpiry };
}

/**
 * Whether a status warrants an alert today. `expired` always does; `expiring`
 * does every day within {@link WARNING_THRESHOLDS_DAYS} of expiry, repeating
 * daily until renewal. Per-alert cooldown (`docs/alerts.md`) prevents spam.
 */
export function shouldAlertOnSslStatus(status: SslStatus, daysUntilExpiry: number | null): boolean {
	if (status === "expired") return true;
	if (status === "expiring" && daysUntilExpiry !== null) {
		return WARNING_THRESHOLDS_DAYS.some((threshold) => daysUntilExpiry <= threshold);
	}
	return false;
}
