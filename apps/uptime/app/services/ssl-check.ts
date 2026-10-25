/**
 * One HTTP monitor's certificate check: refreshes the expiry from Certificate Transparency
 * when the monitor reads it from the logs, classifies the certificate, and persists both,
 * so the daily sweep and the check queued after a settings change behave the same.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";

import type { UptimeModels } from "~/app/models";
import type { Monitor } from "~/app/models/monitors";
import type {
	CertificateLookup,
	CertificateTransparency,
} from "~/app/services/certificate-transparency";
import type { NotifyMessage } from "~/app/services/notify-queue";
import type { InsertMonitor } from "~/database/schema";

import { calculateSslStatus, shouldAlertOnSslStatus } from "~/app/services/ssl-info";

/** The columns a log lookup writes. */
export type TransparencyPatch = Pick<
	InsertMonitor,
	"ssl_expires_at" | "ssl_issuer" | "ssl_transparency_status" | "ssl_transparency_checked_at"
>;

/** What one check did: the lookup it made, if any, and the notification it warrants. */
export interface SslCheck {
	lookup: CertificateLookup | null;
	notification: NotifyMessage | null;
}

/**
 * The host a monitor's certificate is issued for, or `""` for a URL that cannot be parsed,
 * which a lookup answers as `not-found`.
 */
export function monitoredHost(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
}

/**
 * The columns a lookup writes. A found certificate replaces the expiry and issuer; the
 * other outcomes record only the status, so the last known certificate keeps deciding the
 * badge until the logs answer again.
 *
 * @param lookup - What the logs answered.
 * @param now - Epoch milliseconds the lookup ran at.
 */
export function transparencyPatch(
	lookup: CertificateLookup,
	now: number,
): Partial<TransparencyPatch> {
	if (lookup.status === "found") {
		return {
			ssl_expires_at: lookup.certificate.notAfter,
			ssl_issuer: lookup.certificate.issuer,
			ssl_transparency_status: "found",
			ssl_transparency_checked_at: now,
		};
	}
	return { ssl_transparency_status: lookup.status, ssl_transparency_checked_at: now };
}

/**
 * Checks one monitor's certificate and persists the outcome. A monitor whose expiry comes
 * from the logs is looked up first; a typed date is used as it is.
 *
 * @param models - The invocation's models.
 * @param transparency - The run's log client, shared so each host is searched once.
 * @param monitor - A monitor with SSL monitoring enabled.
 * @returns The lookup made and the notification the status warrants, on the shared reminder schedule.
 */
export async function checkSslMonitor(
	models: UptimeModels,
	transparency: CertificateTransparency,
	monitor: Monitor,
): Promise<SslCheck> {
	let now = Date.now();
	let lookup =
		monitor.ssl_expiry_source === "transparency"
			? await transparency.lookup(monitoredHost(monitor.url), now)
			: null;
	let patch = lookup ? transparencyPatch(lookup, now) : {};
	let expiresAt = patch.ssl_expires_at ?? monitor.ssl_expires_at;

	let previousStatus = monitor.ssl_status;
	let { status, daysUntilExpiry } = calculateSslStatus(expiresAt, monitor.ssl_expiry_warning_days);

	unwrap(
		await models.monitors.update(monitor.id, {
			...patch,
			ssl_status: status,
			ssl_last_checked_at: now,
		}),
	);

	if (!shouldAlertOnSslStatus(status, daysUntilExpiry)) return { lookup, notification: null };

	return {
		lookup,
		notification: { monitorType: "ssl", monitorId: monitor.id, previousStatus, newStatus: status },
	};
}
