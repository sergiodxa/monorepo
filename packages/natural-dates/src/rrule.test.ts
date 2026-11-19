/**
 * Holds `toRRule` to writing found repeats as RFC 5545 `RRULE` values, every part in its place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { toRRule } from "./rrule.js";

describe("toRRule", () => {
	test("writes the frequency alone for a plain repeat", () => {
		expect(toRRule({ frequency: "daily" })).toBe("FREQ=DAILY");
	});

	test("writes interval, weekdays, a floating until and a count", () => {
		expect(
			toRRule({
				frequency: "weekly",
				interval: 2,
				byDay: [{ day: "tu" }, { day: "th" }],
				until: "2027-03-31T23:59:59",
			}),
		).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;UNTIL=20270331T235959");
		expect(toRRule({ frequency: "monthly", count: 6 })).toBe("FREQ=MONTHLY;COUNT=6");
	});
});
