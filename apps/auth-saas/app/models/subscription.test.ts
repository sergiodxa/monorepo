/**
 * Behavioural tests for `Subscription`'s pure billing helpers: the Polar → local
 * status mapping (including the aliases `revoked`/`incomplete_expired` and the
 * unknown-status fallback) and the human-readable status label / badge-colour
 * derivations shown in the dashboard. No network or database is touched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import Subscription from "./subscription";

describe("Subscription.mapPolarStatus", () => {
	test("maps active to active", () => {
		expect(Subscription.mapPolarStatus("active")).toBe("active");
	});

	test("maps canceled to canceled", () => {
		expect(Subscription.mapPolarStatus("canceled")).toBe("canceled");
	});

	test("maps revoked to canceled", () => {
		expect(Subscription.mapPolarStatus("revoked")).toBe("canceled");
	});

	test("maps past_due to past_due", () => {
		expect(Subscription.mapPolarStatus("past_due")).toBe("past_due");
	});

	test("maps unpaid to unpaid", () => {
		expect(Subscription.mapPolarStatus("unpaid")).toBe("unpaid");
	});

	test("maps incomplete to incomplete", () => {
		expect(Subscription.mapPolarStatus("incomplete")).toBe("incomplete");
	});

	test("maps incomplete_expired to incomplete", () => {
		expect(Subscription.mapPolarStatus("incomplete_expired")).toBe("incomplete");
	});

	test("maps trialing to trialing", () => {
		expect(Subscription.mapPolarStatus("trialing")).toBe("trialing");
	});

	test("falls back to incomplete for an unknown status", () => {
		expect(Subscription.mapPolarStatus("something-new")).toBe("incomplete");
	});

	test("falls back to incomplete for an empty status", () => {
		expect(Subscription.mapPolarStatus("")).toBe("incomplete");
	});
});

describe("Subscription.isEntitled", () => {
	for (let status of ["active", "trialing", "past_due"]) {
		test(`${status} is entitled (provider stays up)`, () => {
			expect(Subscription.isEntitled(status)).toBe(true);
		});
	}

	for (let status of ["canceled", "unpaid", "incomplete", "mystery", ""]) {
		test(`${status || "<empty>"} is not entitled (tenant suspended)`, () => {
			expect(Subscription.isEntitled(status)).toBe(false);
		});
	}
});

describe("Subscription.getStatusLabel", () => {
	test.each([
		["active", "Active"],
		["trialing", "Trial"],
		["canceled", "Canceled"],
		["past_due", "Past Due"],
		["unpaid", "Unpaid"],
		["incomplete", "Incomplete"],
	])("labels %j as %j", (status, label) => {
		expect(Subscription.getStatusLabel(status)).toBe(label);
	});

	test("returns the raw status for an unknown value", () => {
		expect(Subscription.getStatusLabel("mystery")).toBe("mystery");
	});
});

describe("Subscription.getStatusColor", () => {
	test("uses green for active", () => {
		expect(Subscription.getStatusColor("active")).toBe("bg-green-100 text-green-800");
	});

	test("uses blue for trialing", () => {
		expect(Subscription.getStatusColor("trialing")).toBe("bg-blue-100 text-blue-800");
	});

	test("uses gray for canceled", () => {
		expect(Subscription.getStatusColor("canceled")).toBe("bg-gray-100 text-gray-800");
	});

	test("uses red for past_due", () => {
		expect(Subscription.getStatusColor("past_due")).toBe("bg-red-100 text-red-800");
	});

	test("uses red for unpaid", () => {
		expect(Subscription.getStatusColor("unpaid")).toBe("bg-red-100 text-red-800");
	});

	test("falls back to gray for an unknown status", () => {
		expect(Subscription.getStatusColor("incomplete")).toBe("bg-gray-100 text-gray-800");
		expect(Subscription.getStatusColor("mystery")).toBe("bg-gray-100 text-gray-800");
	});
});
