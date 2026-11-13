/**
 * Checks the bakery's door sign against instants on both sides of each change: opening,
 * the half hour before closing, a closed Monday, a holiday, and a summer morning that only
 * reads right when the clock follows daylight-saving time in the bakery's zone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	formatTime,
	openingStatus,
	pickupDays,
	seasonOf,
	upcomingExceptions,
} from "~/resources/views/demos/bakery/hours";

describe("openingStatus", () => {
	test("is open mid-morning on a Friday and names the closing time", () => {
		let status = openingStatus(new Date("2026-11-13T16:00:00Z"));
		expect(status).toMatchObject({ state: "open", label: "Open now", detail: "closes at 6 pm" });
		expect(status.today.date).toBe("2026-11-13");
	});

	test("warns in the last half hour", () => {
		let status = openingStatus(new Date("2026-11-13T23:45:00Z"));
		expect(status).toMatchObject({ state: "closing-soon", detail: "closes at 6 pm" });
	});

	test("reads the bakery's date, not UTC's, after closing on Friday", () => {
		let status = openingStatus(new Date("2026-11-14T00:30:00Z"));
		expect(status).toMatchObject({ state: "closed", detail: "opens tomorrow at 7 am" });
		expect(status.today.date).toBe("2026-11-13");
	});

	test("says it opens later today before the doors open", () => {
		expect(openingStatus(new Date("2026-11-13T12:00:00Z")).detail).toBe("opens today at 7 am");
	});

	test("skips the closed Monday to Tuesday", () => {
		expect(openingStatus(new Date("2026-11-15T22:00:00Z")).detail).toBe("opens Tuesday at 7 am");
	});

	test("names the holiday and the late start after it", () => {
		let status = openingStatus(new Date("2026-11-26T18:00:00Z"));
		expect(status).toMatchObject({
			state: "closed",
			label: "Closed for Thanksgiving",
			detail: "opens tomorrow at 9 am",
		});
	});

	test("follows daylight-saving time in summer", () => {
		expect(openingStatus(new Date("2026-07-01T12:30:00Z")).state).toBe("open");
		expect(openingStatus(new Date("2026-07-01T11:30:00Z")).detail).toBe("opens today at 7 am");
	});
});

describe("calendar helpers", () => {
	test("offers the next five open days for pickup, never today or a Monday", () => {
		let days = pickupDays(new Date("2026-11-14T16:00:00Z")).map((day) => day.date);
		expect(days).toEqual(["2026-11-15", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
	});

	test("lists the holidays still ahead, soonest first", () => {
		let dates = upcomingExceptions(new Date("2026-11-13T16:00:00Z"), 3).map((day) => day.date);
		expect(dates).toEqual(["2026-11-25", "2026-11-26", "2026-11-27"]);
	});

	test("writes times the way the sign does", () => {
		expect([formatTime(420), formatTime(450), formatTime(720), formatTime(1080)]).toEqual([
			"7 am",
			"7:30 am",
			"noon",
			"6 pm",
		]);
	});

	test("puts November in autumn and December in winter", () => {
		expect([seasonOf("2026-11-13"), seasonOf("2026-12-01")]).toEqual(["autumn", "winter"]);
	});
});
