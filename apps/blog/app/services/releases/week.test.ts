/**
 * Tests for the week a releases run covers: the window must butt against the previous
 * run's, and the slug must follow ISO 8601 week numbering, including the weeks around New
 * Year that belong to the neighbouring year.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { releaseWeek } from "~/app/services/releases/week";

describe("releaseWeek", () => {
	test("covers the seven days before a scheduled Friday run", () => {
		let week = releaseWeek(new Date("2026-10-16T17:00:00Z"));

		expect(week.from).toEqual(new Date("2026-10-09T17:00:00Z"));
		expect(week.to).toEqual(new Date("2026-10-16T17:00:00Z"));
		expect(week.slug).toBe("2026-w42");
	});

	test("anchors a late or retried run to the scheduled run before it", () => {
		let scheduled = releaseWeek(new Date("2026-10-16T17:00:00Z"));

		expect(releaseWeek(new Date("2026-10-16T17:04:31Z"))).toEqual(scheduled);
		expect(releaseWeek(new Date("2026-10-18T09:00:00Z"))).toEqual(scheduled);
		expect(releaseWeek(new Date("2026-10-23T16:59:59Z"))).toEqual(scheduled);
	});

	test("leaves no gap between consecutive runs", () => {
		let first = releaseWeek(new Date("2026-10-16T17:00:00Z"));
		let second = releaseWeek(new Date("2026-10-23T17:00:00Z"));

		expect(second.from).toEqual(first.to);
		expect(second.slug).toBe("2026-w43");
	});

	test("zero-pads a single-digit week", () => {
		expect(releaseWeek(new Date("2026-01-09T17:00:00Z")).slug).toBe("2026-w02");
	});

	test("names a run in late December after the ISO year its week belongs to", () => {
		/** 2026-01-01 is a Thursday, so 2025-12-29 opens week 1 of 2026. */
		let week = releaseWeek(new Date("2025-12-31T23:00:00Z"));

		expect(week.to).toEqual(new Date("2025-12-26T17:00:00Z"));
		expect(week.slug).toBe("2025-w52");
		expect(releaseWeek(new Date("2026-01-02T17:00:00Z")).slug).toBe("2026-w01");
	});

	test("names a run in early January after the previous ISO year when its week began there", () => {
		/** 2027-01-01 is a Friday, so its week is the last week of 2026. */
		let week = releaseWeek(new Date("2027-01-01T17:00:00Z"));

		expect(week.slug).toBe("2026-w53");
		expect(week.isoYear).toBe(2026);
		expect(week.isoWeek).toBe(53);
	});
});
