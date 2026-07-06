/**
 * Unit tests for the SSL certificate status service. They verify calculateSslStatus
 * across expired/expiring/valid/unknown dates, shouldSendSslAlert threshold logic,
 * status text and color mapping, expiry-date parsing, and createSslInfo behavior
 * when monitoring is enabled or disabled, locking in the certificate status rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { addDays, subDays } from "date-fns";

import {
	calculateSslStatus,
	createSslInfo,
	getSslStatusColor,
	getSslStatusText,
	parseSslExpiryDate,
	shouldSendSslAlert,
} from "./check-ssl";

describe("calculateSslStatus", () => {
	test("returns unknown when expiresAt is null", () => {
		let result = calculateSslStatus(null, 30);
		expect(result.status).toBe("unknown");
		expect(result.daysUntilExpiry).toBeNull();
	});

	test("returns expired when certificate has expired", () => {
		let expiresAt = subDays(new Date(), 1);
		let result = calculateSslStatus(expiresAt, 30);
		expect(result.status).toBe("expired");
		expect(result.daysUntilExpiry).toBeLessThan(0);
	});

	test("returns expiring when within warning threshold", () => {
		let expiresAt = addDays(new Date(), 15);
		let result = calculateSslStatus(expiresAt, 30);
		expect(result.status).toBe("expiring");
		expect(result.daysUntilExpiry).toBeGreaterThan(0);
		expect(result.daysUntilExpiry).toBeLessThanOrEqual(30);
	});

	test("returns valid when outside warning threshold", () => {
		let expiresAt = addDays(new Date(), 60);
		let result = calculateSslStatus(expiresAt, 30);
		expect(result.status).toBe("valid");
		expect(result.daysUntilExpiry).toBeGreaterThan(30);
	});
});

describe("shouldSendSslAlert", () => {
	test("returns true for expired status", () => {
		expect(shouldSendSslAlert("expired", -5)).toBe(true);
	});

	test("returns true when expiring and within threshold", () => {
		expect(shouldSendSslAlert("expiring", 7, [30, 14, 7, 1])).toBe(true);
		expect(shouldSendSslAlert("expiring", 14, [30, 14, 7, 1])).toBe(true);
		expect(shouldSendSslAlert("expiring", 1, [30, 14, 7, 1])).toBe(true);
	});

	test("returns false for valid status", () => {
		expect(shouldSendSslAlert("valid", 60)).toBe(false);
	});

	test("returns false for unknown status", () => {
		expect(shouldSendSslAlert("unknown", null)).toBe(false);
	});
});

describe("getSslStatusText", () => {
	test("returns appropriate text for each status", () => {
		expect(getSslStatusText("valid", 60)).toContain("Valid");
		expect(getSslStatusText("expiring", 7)).toContain("7 days");
		expect(getSslStatusText("expired", -1)).toBe("Expired");
		expect(getSslStatusText("error", null)).toContain("Error");
		expect(getSslStatusText("unknown", null)).toBe("Not configured");
	});
});

describe("getSslStatusColor", () => {
	test("returns correct color for each status", () => {
		expect(getSslStatusColor("valid")).toBe("success");
		expect(getSslStatusColor("expiring")).toBe("warning");
		expect(getSslStatusColor("expired")).toBe("error");
		expect(getSslStatusColor("error")).toBe("error");
		expect(getSslStatusColor("unknown")).toBe("neutral");
	});
});

describe("parseSslExpiryDate", () => {
	test("returns null for null input", () => {
		expect(parseSslExpiryDate(null)).toBeNull();
	});

	test("returns null for invalid date string", () => {
		expect(parseSslExpiryDate("not-a-date")).toBeNull();
	});

	test("parses valid ISO date string", () => {
		let result = parseSslExpiryDate("2025-12-31");
		expect(result).toBeInstanceOf(Date);
		expect(result?.getFullYear()).toBe(2025);
	});

	test("returns Date instance as-is", () => {
		let date = new Date("2025-12-31");
		expect(parseSslExpiryDate(date)).toEqual(date);
	});
});

describe("createSslInfo", () => {
	test("returns unknown status when SSL monitoring is disabled", () => {
		let result = createSslInfo({
			sslMonitoringEnabled: false,
			sslExpiryWarningDays: 30,
			sslExpiresAt: addDays(new Date(), 15),
			sslIssuer: "Let's Encrypt",
			sslLastCheckedAt: new Date(),
			sslStatus: "expiring",
		});

		expect(result.enabled).toBe(false);
		expect(result.status).toBe("unknown");
	});

	test("calculates status when SSL monitoring is enabled", () => {
		let expiresAt = addDays(new Date(), 15);
		let result = createSslInfo({
			sslMonitoringEnabled: true,
			sslExpiryWarningDays: 30,
			sslExpiresAt: expiresAt,
			sslIssuer: "Let's Encrypt",
			sslLastCheckedAt: new Date(),
			sslStatus: null,
		});

		expect(result.enabled).toBe(true);
		expect(result.status).toBe("expiring");
		expect(result.expiresAt).toEqual(expiresAt);
		expect(result.issuer).toBe("Let's Encrypt");
	});
});
