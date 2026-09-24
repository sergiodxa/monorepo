/**
 * Checks the value types a calendar carries (RFC 5545 §3.3): DATE and the three forms of
 * DATE-TIME, DURATION with its grammar's quirks, PERIOD, and UTC-OFFSET, read and written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import {
	formatDateValue,
	formatDuration,
	formatPeriod,
	formatUtcOffset,
	parseDateValue,
	parseDuration,
	parsePeriod,
	parseUtcOffset,
} from "./values.js";

describe("parseDateValue", () => {
	test("reads a DATE", () => {
		expect(parseDateValue("19971102", { VALUE: ["DATE"] })).toEqual({
			type: "date",
			year: 1997,
			month: 11,
			day: 2,
		});
	});

	test("reads an eight-digit value as a DATE without VALUE=DATE", () => {
		expect(parseDateValue("20070628", {})?.type).toBe("date");
	});

	test("reads a UTC DATE-TIME", () => {
		expect(parseDateValue("19980119T070000Z", {})).toEqual({
			type: "date-time",
			wall: { year: 1998, month: 1, day: 19, hour: 7, minute: 0, second: 0 },
			zone: "utc",
		});
	});

	test("reads a floating DATE-TIME", () => {
		expect(parseDateValue("19980118T230000", {})).toMatchObject({ zone: "floating" });
	});

	test("reads a DATE-TIME in a TZID", () => {
		expect(parseDateValue("19980119T020000", { TZID: ["America/New_York"] })).toMatchObject({
			zone: { tzid: "America/New_York" },
		});
	});

	test("reads the Z of a UTC time over a TZID parameter", () => {
		expect(parseDateValue("19980119T070000Z", { TZID: ["America/New_York"] })).toMatchObject({
			zone: "utc",
		});
	});

	test("refuses a day the month does not have", () => {
		expect(parseDateValue("20070230", {})).toBeNull();
		expect(parseDateValue("20070101T250000Z", {})).toBeNull();
		expect(parseDateValue("2007-01-01", {})).toBeNull();
	});
});

describe("formatDateValue", () => {
	test("writes a DATE with VALUE=DATE", () => {
		expect(formatDateValue({ type: "date", year: 2007, month: 6, day: 28 })).toEqual({
			value: "20070628",
			parameters: { VALUE: ["DATE"] },
		});
	});

	test("writes UTC with a Z, floating bare and zoned with TZID", () => {
		let wall = { year: 2026, month: 9, day: 23, hour: 10, minute: 0, second: 5 };
		expect(formatDateValue({ type: "date-time", wall, zone: "utc" }).value).toBe(
			"20260923T100005Z",
		);
		expect(formatDateValue({ type: "date-time", wall, zone: "floating" })).toEqual({
			value: "20260923T100005",
			parameters: {},
		});
		expect(formatDateValue({ type: "date-time", wall, zone: { tzid: "Europe/Madrid" } })).toEqual({
			value: "20260923T100005",
			parameters: { TZID: ["Europe/Madrid"] },
		});
	});

	test("pads years below 1000", () => {
		expect(formatDateValue({ type: "date", year: 800, month: 1, day: 1 }).value).toBe("08000101");
	});
});

describe("parseDuration", () => {
	test("reads the RFC's examples", () => {
		expect(parseDuration("P15DT5H0M20S")).toEqual({ days: 15, hours: 5, minutes: 0, seconds: 20 });
		expect(parseDuration("P7W")).toEqual({ weeks: 7 });
		expect(parseDuration("-PT15M")).toEqual({ negative: true, minutes: 15 });
		expect(parseDuration("+PT1H")).toEqual({ hours: 1 });
	});

	test("accepts weeks mixed with days, which some producers write", () => {
		expect(parseDuration("P1W2D")).toEqual({ weeks: 1, days: 2 });
	});

	test("refuses an empty or malformed duration", () => {
		expect(parseDuration("P")).toBeNull();
		expect(parseDuration("PT")).toBeNull();
		expect(parseDuration("1H")).toBeNull();
		expect(parseDuration("P1H")).toBeNull();
	});
});

describe("formatDuration", () => {
	test("writes weeks alone as weeks", () => {
		expect(formatDuration({ weeks: 2 })).toBe("P2W");
	});

	test("folds weeks into days when other parts are present", () => {
		expect(formatDuration({ weeks: 1, days: 1, hours: 2 })).toBe("P8DT2H");
	});

	test("writes the zero minutes the grammar needs between hours and seconds", () => {
		expect(formatDuration({ hours: 1, seconds: 5 })).toBe("PT1H0M5S");
	});

	test("writes a negative duration and a zero one", () => {
		expect(formatDuration({ negative: true, minutes: 30 })).toBe("-PT30M");
		expect(formatDuration({})).toBe("PT0S");
	});
});

describe("parsePeriod and formatPeriod", () => {
	test("read an explicit period", () => {
		let period = parsePeriod("19970101T180000Z/19970102T070000Z", {});
		expect(period).toMatchObject({
			type: "period",
			start: { zone: "utc", wall: { hour: 18 } },
			end: { zone: "utc", wall: { day: 2, hour: 7 } },
		});
		expect(period && formatPeriod(period).value).toBe("19970101T180000Z/19970102T070000Z");
	});

	test("read a period with a duration", () => {
		let period = parsePeriod("19970101T180000Z/PT5H30M", {});
		expect(period).toMatchObject({ duration: { hours: 5, minutes: 30 } });
		expect(period && formatPeriod(period).value).toBe("19970101T180000Z/PT5H30M");
	});

	test("apply a TZID parameter to both ends", () => {
		let period = parsePeriod("19970101T090000/19970101T100000", { TZID: ["Europe/Paris"] });
		expect(period?.start).toMatchObject({ zone: { tzid: "Europe/Paris" } });
		expect(period?.end).toMatchObject({ zone: { tzid: "Europe/Paris" } });
	});

	test("refuse a value without a slash", () => {
		expect(parsePeriod("19970101T180000Z", {})).toBeNull();
	});
});

describe("UTC offsets", () => {
	test("read hours, minutes and seconds east of UTC", () => {
		expect(parseUtcOffset("-0500")).toBe(-300);
		expect(parseUtcOffset("+0530")).toBe(330);
		expect(parseUtcOffset("+001932")).toBeCloseTo(19.5333, 3);
		expect(parseUtcOffset("0500")).toBeNull();
	});

	test("write them back", () => {
		expect(formatUtcOffset(-300)).toBe("-0500");
		expect(formatUtcOffset(330)).toBe("+0530");
		expect(formatUtcOffset(0)).toBe("+0000");
		expect(formatUtcOffset(19 + 32 / 60)).toBe("+001932");
	});
});
