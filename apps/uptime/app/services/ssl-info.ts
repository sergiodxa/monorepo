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

import { classifyExpiry, shouldRemindOfExpiry } from "~/app/services/expiry";

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
	return classifyExpiry(expiresAt, warningDays);
}

/**
 * Whether a status warrants an alert today, on the reminder schedule every expiry date
 * shares. Per-alert cooldown (`docs/alerts.md`) prevents spam.
 */
export function shouldAlertOnSslStatus(status: SslStatus, daysUntilExpiry: number | null): boolean {
	return shouldRemindOfExpiry(status, daysUntilExpiry);
}
