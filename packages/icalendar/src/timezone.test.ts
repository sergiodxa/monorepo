/**
 * Checks time zones both ways: `VTIMEZONE`s generated from `Intl` list the right transitions
 * and resolve like `Intl` does, and the RFC's own `VTIMEZONE` examples resolve `TZID`s to the
 * offsets they define, DST gaps and repeated hours included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";

import { instantFromParts } from "@sdxc/dates/zone";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { TimeZoneError, vtimezone } from "./timezone.js";

import type { ICalendar } from "./index.js";

import { parse, stringify, toInstant } from "./index.js";

/** A day in milliseconds. */
const DAY = 86_400_000;

/**
 * A vendored RFC 5545 example, parsed.
 *
 * @param name - The file name under `fixtures/rfc5545`
 * @returns The calendar
 */
function example(name: string): ICalendar.Calendar {
	let text = readFileSync(new URL(`./fixtures/rfc5545/${name}`, import.meta.url), "utf8");
	return unwrap(parse(text)).calendar;
}

/**
 * A zoned DATE-TIME.
 *
 * @param tzid - The zone
 * @param wall - The local time
 * @returns The value
 */
function zoned(tzid: string, wall: ICalendar.WallClock): ICalendar.DateValue {
	return { type: "date-time", wall, zone: { tzid } };
}

/**
 * A wall clock from its fields.
 *
 * @param year - Year
 * @param month - Month
 * @param day - Day
 * @param hour - Hour
 * @param minute - Minute
 * @returns The wall clock
 */
function wall(
	year: number,
	month: number,
	day: number,
	hour = 12,
	minute = 0,
): ICalendar.WallClock {
	return { year, month, day, hour, minute, second: 0 };
}

/**
 * A calendar holding only one time zone.
 *
 * @param zone - The time zone
 * @returns The calendar
 */
function calendarWith(zone: ICalendar.TimeZone): ICalendar.Calendar {
	return {
		productId: "-//test//EN",
		timeZones: [zone],
		events: [],
		components: [],
		properties: [],
	};
}

/**
 * Offsets from UTC, in hours, at noon local time on a day, read through a calendar.
 *
 * @param calendar - The calendar defining the zone
 * @param tzid - The zone
 * @param day - The local day
 * @returns Hours east of UTC
 */
function offsetHours(
	calendar: ICalendar.Calendar,
	tzid: string,
	day: ICalendar.WallClock,
): number | null {
	let instant = toInstant(zoned(tzid, day), calendar);
	return instant === null
		? null
		: (Date.UTC(day.year, day.month - 1, day.day, day.hour, day.minute) - instant) / 3_600_000;
}

describe("the RFC's New York VTIMEZONE", () => {
	test("resolves every day since 1967 exactly as Intl does", () => {
		let calendar = example("section-3.6.5-new-york-full.ics");
		for (let day = Date.UTC(1967, 5, 1); day < Date.UTC(2031, 0, 1); day += 3 * DAY) {
			let date = new Date(day);
			let local = wall(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
			let expected = instantFromParts({ ...local, millisecond: 0 }, "America/New_York");
			expect(toInstant(zoned("America/New_York", local), calendar), date.toISOString()).toBe(
				expected,
			);
		}
	});

	test("reads a time in the spring gap with the offset before it and a repeated time as the first", () => {
		let calendar = example("section-3.6.5-new-york-full.ics");
		expect(toInstant(zoned("America/New_York", wall(2026, 3, 8, 2, 30)), calendar)).toBe(
			Date.UTC(2026, 2, 8, 7, 30),
		);
		expect(toInstant(zoned("America/New_York", wall(2026, 11, 1, 1, 30)), calendar)).toBe(
			Date.UTC(2026, 10, 1, 5, 30),
		);
		expect(toInstant(zoned("America/New_York", wall(1975, 2, 23, 2, 30)), calendar)).toBe(
			Date.UTC(1975, 1, 23, 7, 30),
		);
	});

	test("uses the calendar's definition ahead of Intl", () => {
		let calendar = example("section-3.6.5-fictitious-ending.ics");
		calendar.timeZones[0] = {
			...calendar.timeZones[0],
			tzid: "America/New_York",
			observances: calendar.timeZones[0]?.observances ?? [],
		};
		expect(offsetHours(calendar, "America/New_York", wall(2026, 7, 1))).toBe(-5);
	});
});

describe("the RFC's other VTIMEZONE examples", () => {
	test("New York with DTSTART only covers March 2007 to March 2008", () => {
		let calendar = example("section-3.6.5-new-york-dtstart-only.ics");
		expect(offsetHours(calendar, "America/New_York", wall(2007, 7, 1))).toBe(-4);
		expect(offsetHours(calendar, "America/New_York", wall(2007, 12, 1))).toBe(-5);
	});

	test("New York with yearly rules keeps going", () => {
		let calendar = example("section-3.6.5-new-york-rrule.ics");
		expect(offsetHours(calendar, "America/New_York", wall(2040, 7, 1))).toBe(-4);
		expect(offsetHours(calendar, "America/New_York", wall(2040, 1, 1))).toBe(-5);
	});

	test("a daylight rule with an end stops at its UNTIL", () => {
		let calendar = example("section-3.6.5-fictitious-ending.ics");
		expect(offsetHours(calendar, "Fictitious", wall(1997, 7, 1))).toBe(-4);
		expect(offsetHours(calendar, "Fictitious", wall(1998, 7, 1))).toBe(-5);
		expect(offsetHours(calendar, "Fictitious", wall(2005, 7, 1))).toBe(-5);
	});

	test("a second daylight rule picks up where the first left off, from its own DTSTART", () => {
		let calendar = example("section-3.6.5-fictitious-resumed.ics");
		expect(offsetHours(calendar, "Fictitious", wall(1998, 7, 1))).toBe(-5);
		expect(offsetHours(calendar, "Fictitious", wall(1999, 7, 1))).toBe(-4);
		expect(offsetHours(calendar, "Fictitious", wall(1999, 4, 23))).toBe(-5);
		expect(offsetHours(calendar, "Fictitious", wall(1999, 4, 24))).toBe(-4);
	});

	test("a TZID the calendar does not define and Intl does not know resolves to null", () => {
		let calendar = example("section-3.6.5-fictitious-ending.ics");
		expect(toInstant(zoned("Nowhere/Special", wall(2026, 1, 1)), calendar)).toBeNull();
	});
});

describe("vtimezone", () => {
	test("lists the transition in force at the span's start and every one inside it", () => {
		let zone = unwrap(
			vtimezone("America/New_York", { from: Date.UTC(2026, 0, 1), to: Date.UTC(2027, 0, 1) }),
		);
		expect(zone).toEqual({
			tzid: "America/New_York",
			observances: [
				{
					kind: "STANDARD",
					start: wall(2025, 11, 2, 2),
					offsetFrom: -240,
					offsetTo: -300,
					name: "EST",
				},
				{
					kind: "DAYLIGHT",
					start: wall(2026, 3, 8, 2),
					offsetFrom: -300,
					offsetTo: -240,
					name: "EDT",
				},
				{
					kind: "STANDARD",
					start: wall(2026, 11, 1, 2),
					offsetFrom: -240,
					offsetTo: -300,
					name: "EST",
				},
			],
		});
	});

	test("resolves like Intl across the span once written and read back", () => {
		let span = { from: Date.UTC(2026, 0, 1), to: Date.UTC(2028, 0, 1) };
		let zone = unwrap(vtimezone("Europe/Madrid", span));
		let calendar = unwrap(parse(stringify(calendarWith(zone)))).calendar;
		expect(calendar.timeZones).toEqual([zone]);
		for (let day = span.from; day < span.to; day += DAY) {
			let date = new Date(day);
			let local = wall(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 3);
			let expected = instantFromParts({ ...local, millisecond: 0 }, "Europe/Madrid");
			expect(toInstant(zoned("Europe/Madrid", local), calendar)).toBe(expected);
		}
	});

	test("marks the southern hemisphere's summer offset as daylight", () => {
		let zone = unwrap(
			vtimezone("Australia/Sydney", { from: Date.UTC(2026, 0, 1), to: Date.UTC(2027, 0, 1) }),
		);
		expect(zone.observances.map(({ kind, offsetTo }) => [kind, offsetTo])).toEqual([
			["DAYLIGHT", 660],
			["STANDARD", 600],
			["DAYLIGHT", 660],
		]);
	});

	test("writes one observance for a zone without transitions", () => {
		let from = Date.UTC(2026, 0, 1);
		let zone = unwrap(vtimezone("Asia/Tokyo", { from, to: Date.UTC(2027, 0, 1) }));
		expect(zone.observances).toEqual([
			{
				kind: "STANDARD",
				start: wall(2026, 1, 1, 9),
				offsetFrom: 540,
				offsetTo: 540,
				name: "GMT+9",
			},
		]);
	});

	test("keeps an offset with minutes", () => {
		let zone = unwrap(
			vtimezone("Asia/Kathmandu", { from: Date.UTC(2026, 0, 1), to: Date.UTC(2026, 1, 1) }),
		);
		expect(zone.observances[0]?.offsetTo).toBe(345);
	});

	test("refuses a zone Intl does not know and a span that ends before it starts", () => {
		let unknown = vtimezone("Nowhere/Special", { from: 0, to: 1 });
		expect(isFailure(unknown) && unknown.error).toBeInstanceOf(TimeZoneError);
		expect(isFailure(vtimezone("UTC", { from: 10, to: 0 }))).toBe(true);
	});
});
