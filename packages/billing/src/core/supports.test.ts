/**
 * Tests the capability check against providers that do and do not carry an
 * optional group, since the whole point of the mechanism is that the answer
 * comes from the implementation rather than from a declaration beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { MemoryBilling } from "../providers/memory";

import { OPTIONAL_CAPABILITIES, supports } from "./supports";

describe("supports", () => {
	test("answers yes for a group the provider carries", () => {
		let billing = new MemoryBilling();

		expect(supports(billing, "meters")).toBe(true);
	});

	test("answers no for a group the provider leaves absent", () => {
		let billing = Object.assign(new MemoryBilling(), { meters: undefined });

		expect(supports(billing, "meters")).toBe(false);
	});

	test("narrows the group to present inside the branch", async () => {
		let billing = new MemoryBilling();

		expect(supports(billing, "meters")).toBe(true);
		if (!supports(billing, "meters")) return;

		let reading = await billing.meters.quantities({
			meter: "pings",
			from: new Date("2026-09-01T00:00:00Z"),
			to: new Date("2026-09-30T00:00:00Z"),
			interval: "day",
		});

		expect(reading.status).toBe("success");
	});
});

describe("OPTIONAL_CAPABILITIES", () => {
	test("names every group the contract leaves optional", () => {
		expect(OPTIONAL_CAPABILITIES).toEqual(["discounts", "meters", "portal", "usage"]);
	});
});
