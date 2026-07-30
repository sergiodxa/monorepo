/**
 * Tests for the instant and wall-clock conversions, including the two days a year
 * where a wall time is ambiguous or missing, and zones whose offset is not a whole
 * number of hours. An unknown zone must come back as `null` rather than throw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { instantFromWallClock, zonedPartsOf } from "./time-zone";

describe("zonedPartsOf", () => {
	test("reads an instant's fields in the zone asked for", () => {
		expect(zonedPartsOf(Date.UTC(2026, 5, 15, 12, 34, 56), "UTC")).toEqual({
			year: 2026,
			month: 6,
			day: 15,
			hour: 12,
			minute: 34,
			second: 56,
		});
	});

	test("counts hours from zero to twenty-three, midnight included", () => {
		expect(zonedPartsOf(Date.UTC(2026, 0, 1, 0, 0), "UTC")?.hour).toBe(0);
		expect(zonedPartsOf(Date.UTC(2026, 0, 1, 23, 59), "UTC")?.hour).toBe(23);
		expect(zonedPartsOf(Date.UTC(2026, 0, 1, 5, 0), "America/New_York")?.hour).toBe(0);
	});

	test("shifts the date when the zone is on the other side of midnight", () => {
		expect(zonedPartsOf(Date.UTC(2026, 0, 1, 2, 0), "America/New_York")).toMatchObject({
			year: 2025,
			month: 12,
			day: 31,
			hour: 21,
		});
		expect(zonedPartsOf(Date.UTC(2025, 11, 31, 20, 0), "Asia/Tokyo")).toMatchObject({
			year: 2026,
			month: 1,
			day: 1,
			hour: 5,
		});
	});

	test("reads offsets that are not whole hours", () => {
		expect(zonedPartsOf(Date.UTC(2026, 5, 15, 3, 30), "Asia/Kolkata")?.hour).toBe(9);
		expect(zonedPartsOf(Date.UTC(2026, 5, 15, 3, 15), "Asia/Kathmandu")).toMatchObject({
			hour: 9,
			minute: 0,
		});
	});

	test("returns null instead of throwing for a zone the runtime rejects", () => {
		expect(zonedPartsOf(Date.UTC(2026, 0, 1), "Mars/Olympus_Mons")).toBe(null);
		expect(() => zonedPartsOf(Date.UTC(2026, 0, 1), "not a zone")).not.toThrow();
	});

	test("returns null for a timestamp that is not a finite number", () => {
		expect(zonedPartsOf(Number.NaN, "UTC")).toBe(null);
		expect(zonedPartsOf(Number.POSITIVE_INFINITY, "UTC")).toBe(null);
	});
});

describe("instantFromWallClock", () => {
	test("resolves an ordinary wall time", () => {
		expect(
			instantFromWallClock({ year: 2026, month: 6, day: 15, hour: 12, minute: 0 }, "UTC"),
		).toBe(Date.UTC(2026, 5, 15, 12, 0));
		expect(
			instantFromWallClock(
				{ year: 2026, month: 6, day: 15, hour: 9, minute: 0 },
				"America/New_York",
			),
		).toBe(Date.UTC(2026, 5, 15, 13, 0));
	});

	test("keeps a wall time put when the offset changes around it", () => {
		let before = instantFromWallClock(
			{ year: 2026, month: 3, day: 7, hour: 9, minute: 0 },
			"America/New_York",
		);
		let after = instantFromWallClock(
			{ year: 2026, month: 3, day: 8, hour: 9, minute: 0 },
			"America/New_York",
		);
		expect(new Date(before ?? 0).toISOString()).toBe("2026-03-07T14:00:00.000Z");
		expect(new Date(after ?? 0).toISOString()).toBe("2026-03-08T13:00:00.000Z");
	});

	test("gives an ambiguous wall time its first pass, so a schedule fires once", () => {
		// 2026-11-01 01:30 happens twice in New York: 05:30Z as EDT, 06:30Z as EST.
		expect(
			new Date(
				instantFromWallClock(
					{ year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
					"America/New_York",
				) ?? 0,
			).toISOString(),
		).toBe("2026-11-01T05:30:00.000Z");

		// 2026-10-25 02:30 happens twice in Madrid: 00:30Z as CEST, 01:30Z as CET.
		expect(
			new Date(
				instantFromWallClock(
					{ year: 2026, month: 10, day: 25, hour: 2, minute: 30 },
					"Europe/Madrid",
				) ?? 0,
			).toISOString(),
		).toBe("2026-10-25T00:30:00.000Z");
	});

	test("carries a missing wall time forward past the jump", () => {
		// 2026-03-08 02:30 never happens in New York; the offset before the jump puts
		// it at 07:30Z, which reads as 03:30 EDT.
		expect(
			new Date(
				instantFromWallClock(
					{ year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
					"America/New_York",
				) ?? 0,
			).toISOString(),
		).toBe("2026-03-08T07:30:00.000Z");

		// 2026-03-29 02:30 never happens in Madrid; it lands at 01:30Z, or 03:30 CEST.
		expect(
			new Date(
				instantFromWallClock(
					{ year: 2026, month: 3, day: 29, hour: 2, minute: 30 },
					"Europe/Madrid",
				) ?? 0,
			).toISOString(),
		).toBe("2026-03-29T01:30:00.000Z");
	});

	test("round-trips every wall time of a transition day", () => {
		for (let hour = 0; hour < 24; hour++) {
			for (let minute of [0, 30]) {
				let instant = instantFromWallClock(
					{ year: 2026, month: 11, day: 1, hour, minute },
					"America/New_York",
				);
				expect(instant).not.toBe(null);
				let parts = zonedPartsOf(instant ?? 0, "America/New_York");
				expect(parts?.day).toBe(1);
				expect(parts?.hour).toBe(hour);
				expect(parts?.minute).toBe(minute);
			}
		}
	});

	test("returns null instead of throwing for an unknown zone", () => {
		expect(
			instantFromWallClock({ year: 2026, month: 1, day: 1, hour: 0, minute: 0 }, "Nowhere/Land"),
		).toBe(null);
	});
});
