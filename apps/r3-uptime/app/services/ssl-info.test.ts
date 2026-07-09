import { describe, expect, test } from "bun:test";

import { calculateSslStatus, shouldAlertOnSslStatus } from "~/app/services/ssl-info";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("calculateSslStatus", () => {
	test("unknown when no expiry is set", () => {
		expect(calculateSslStatus(null, 30)).toEqual({ status: "unknown", daysUntilExpiry: null });
	});

	test("expired when the expiry date is in the past", () => {
		let result = calculateSslStatus(Date.now() - DAY_MS, 30);
		expect(result.status).toBe("expired");
		expect(result.daysUntilExpiry).toBeLessThan(0);
	});

	test("expiring when within the warning window", () => {
		let result = calculateSslStatus(Date.now() + 5 * DAY_MS, 30);
		expect(result.status).toBe("expiring");
	});

	test("valid when outside the warning window", () => {
		let result = calculateSslStatus(Date.now() + 60 * DAY_MS, 30);
		expect(result.status).toBe("valid");
	});
});

describe("shouldAlertOnSslStatus", () => {
	test("always alerts when expired", () => {
		expect(shouldAlertOnSslStatus("expired", -5)).toBe(true);
		expect(shouldAlertOnSslStatus("expired", null)).toBe(true);
	});

	test("alerts every day within a warning threshold", () => {
		expect(shouldAlertOnSslStatus("expiring", 30)).toBe(true);
		expect(shouldAlertOnSslStatus("expiring", 15)).toBe(true);
		expect(shouldAlertOnSslStatus("expiring", 1)).toBe(true);
		expect(shouldAlertOnSslStatus("expiring", 0)).toBe(true);
	});

	test("does not alert outside any threshold", () => {
		expect(shouldAlertOnSslStatus("expiring", 31)).toBe(false);
	});

	test("never alerts for valid/unknown/error", () => {
		expect(shouldAlertOnSslStatus("valid", 60)).toBe(false);
		expect(shouldAlertOnSslStatus("unknown", null)).toBe(false);
		expect(shouldAlertOnSslStatus("error", null)).toBe(false);
	});
});
