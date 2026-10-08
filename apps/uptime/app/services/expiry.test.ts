/**
 * Unit tests for the shared expiry classification: the four statuses against a warning
 * window, and the reminder days both certificates and domain registrations alert on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DAY_MS } from "@sdxc/dates/zone";
import { describe, expect, test } from "vitest";

import { classifyExpiry, shouldRemindOfExpiry } from "./expiry";

describe("classifyExpiry", () => {
	test("classifies a date against the warning window", () => {
		let now = Date.now();
		expect(classifyExpiry(null, 30)).toEqual({ status: "unknown", daysUntilExpiry: null });
		expect(classifyExpiry(now + 90.5 * DAY_MS, 30)).toEqual({
			status: "valid",
			daysUntilExpiry: 90,
		});
		expect(classifyExpiry(now + 10.5 * DAY_MS, 30)).toEqual({
			status: "expiring",
			daysUntilExpiry: 10,
		});
		expect(classifyExpiry(now - 2 * DAY_MS, 30).status).toBe("expired");
	});
});

describe("shouldRemindOfExpiry", () => {
	test("reminds on threshold days and every day after expiry", () => {
		expect(shouldRemindOfExpiry("expiring", 30)).toBe(true);
		expect(shouldRemindOfExpiry("expiring", 1)).toBe(true);
		expect(shouldRemindOfExpiry("expired", -3)).toBe(true);
		expect(shouldRemindOfExpiry("valid", 100)).toBe(false);
		expect(shouldRemindOfExpiry("unknown", null)).toBe(false);
	});
});
