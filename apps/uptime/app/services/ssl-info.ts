/**
 * SSL certificate status calculation: classifies a certificate as valid, expiring, or
 * expired against the monitor's warning threshold, from the expiry date Certificate
 * Transparency logs supplied or the one the user typed as an override.
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
