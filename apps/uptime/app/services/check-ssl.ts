import { differenceInDays, isBefore } from "date-fns";

export type SslStatus = "unknown" | "valid" | "expiring" | "expired" | "error";

export interface SslCheckResult {
	status: SslStatus;
	expiresAt: Date | null;
	issuer: string | null;
	daysUntilExpiry: number | null;
	error?: string;
}

/**
 * Determines the SSL status based on expiry date and warning threshold.
 *
 * Since Cloudflare Workers cannot directly access TLS certificate details from fetch(),
 * this service relies on manually entered SSL expiry dates. Users can input:
 * - The certificate expiry date (from their hosting provider or cert issuer)
 * - The issuer information
 *
 * The service then calculates:
 * - Days until expiry
 * - Status (valid, expiring, expired)
 * - Whether alerts should be sent
 */
export function calculateSslStatus(
	expiresAt: Date | null,
	warningDays: number,
): { status: SslStatus; daysUntilExpiry: number | null } {
	if (!expiresAt) {
		return { status: "unknown", daysUntilExpiry: null };
	}

	let now = new Date();
	let daysUntilExpiry = differenceInDays(expiresAt, now);

	if (isBefore(expiresAt, now)) {
		return { status: "expired", daysUntilExpiry };
	}

	if (daysUntilExpiry <= warningDays) {
		return { status: "expiring", daysUntilExpiry };
	}

	return { status: "valid", daysUntilExpiry };
}

/**
 * Checks if an SSL alert should be sent based on the current status and warning thresholds.
 *
 * Alerts are sent when:
 * - Certificate is expired
 * - Certificate expires within the warning threshold (default: 30, 14, 7, 1 days)
 */
export function shouldSendSslAlert(
	status: SslStatus,
	daysUntilExpiry: number | null,
	warningThresholds: number[] = [30, 14, 7, 1],
): boolean {
	if (status === "expired") {
		return true;
	}

	if (status === "expiring" && daysUntilExpiry !== null) {
		// Send alert if days until expiry matches any threshold
		return warningThresholds.some((threshold) => daysUntilExpiry <= threshold);
	}

	return false;
}

/**
 * Gets human-readable status text for the SSL certificate.
 */
export function getSslStatusText(status: SslStatus, daysUntilExpiry: number | null): string {
	switch (status) {
		case "valid":
			return daysUntilExpiry !== null ? `Valid (expires in ${daysUntilExpiry} days)` : "Valid";
		case "expiring":
			return daysUntilExpiry !== null
				? `Expiring soon (${daysUntilExpiry} days left)`
				: "Expiring soon";
		case "expired":
			return "Expired";
		case "error":
			return "Error checking certificate";
		case "unknown":
		default:
			return "Not configured";
	}
}

/**
 * Gets the color/severity for the SSL status.
 */
export function getSslStatusColor(status: SslStatus): "success" | "warning" | "error" | "neutral" {
	switch (status) {
		case "valid":
			return "success";
		case "expiring":
			return "warning";
		case "expired":
		case "error":
			return "error";
		case "unknown":
		default:
			return "neutral";
	}
}

/**
 * Validates and parses an SSL expiry date input.
 * Accepts ISO date strings or Date objects.
 */
export function parseSslExpiryDate(input: string | Date | null): Date | null {
	if (!input) return null;

	if (input instanceof Date) {
		return Number.isNaN(input.getTime()) ? null : input;
	}

	let parsed = new Date(input);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Creates SSL info object from monitor data for use in UI components.
 */
export function createSslInfo(monitor: {
	sslMonitoringEnabled: boolean;
	sslExpiryWarningDays: number;
	sslExpiresAt: Date | null;
	sslIssuer: string | null;
	sslLastCheckedAt: Date | null;
	sslStatus: SslStatus | null;
}): {
	enabled: boolean;
	status: SslStatus;
	statusText: string;
	statusColor: "success" | "warning" | "error" | "neutral";
	expiresAt: Date | null;
	issuer: string | null;
	lastCheckedAt: Date | null;
	daysUntilExpiry: number | null;
	warningDays: number;
} {
	let { status, daysUntilExpiry } = calculateSslStatus(
		monitor.sslExpiresAt,
		monitor.sslExpiryWarningDays,
	);

	// Use the calculated status if SSL monitoring is enabled
	let effectiveStatus = monitor.sslMonitoringEnabled ? status : "unknown";

	return {
		enabled: monitor.sslMonitoringEnabled,
		status: effectiveStatus,
		statusText: getSslStatusText(effectiveStatus, daysUntilExpiry),
		statusColor: getSslStatusColor(effectiveStatus),
		expiresAt: monitor.sslExpiresAt,
		issuer: monitor.sslIssuer,
		lastCheckedAt: monitor.sslLastCheckedAt,
		daysUntilExpiry,
		warningDays: monitor.sslExpiryWarningDays,
	};
}
