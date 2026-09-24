/**
 * Checks recurrence rules: reading and writing the RRULE value, every example RFC 5545
 * §3.8.5.3 prints expanded and compared occurrence by occurrence, and the bounds, exceptions,
 * extra dates and durations an event's recurrence set combines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { zonedParts } from "@sdxc/dates/zone";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { occurrences, parseRecurrence, RecurrenceRuleError, stringifyRecurrence } from "./rrule.js";

import type { ICalendar } from "./index.js";

import { parse } from "./index.js";

/** Every RFC example assumes this zone. */
const NEW_YORK = "America/New_York";

/**
 * Reads a one-event calendar, so each example goes through the reader as a client's file would.
 *
 * @param lines - The event's content lines, between `BEGIN:VEVENT` and `END:VEVENT`
 * @returns The calendar and its event
 */
function readEvent(lines: string[]): { calendar: ICalendar.Calendar; event: ICalendar.Event } {
	let text = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//test//EN",
		"BEGIN:VEVENT",
		"UID:example@test",
		"DTSTAMP:19970901T000000Z",
		...lines,
		"END:VEVENT",
		"END:VCALENDAR",
	].join("\r\n");
	let { calendar } = unwrap(parse(text));
	let [event] = calendar.events;
	if (!event) return expect.unreachable("the fixture has no event");
	return { calendar, event };
}

/**
 * The wall clock New York shows at an instant, as `YYYY-MM-DD HH:MM`.
 *
 * @param instant - Epoch milliseconds
 * @returns The local date and time
 */
function local(instant: number): string {
	let parts = zonedParts(instant, NEW_YORK);
	let pad = (value: number) => String(value).padStart(2, "0");
	return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

/**
 * Local date-times on some days of one month, the way the RFC lists them.
 *
 * @param year - Year
 * @param month - Month
 * @param days - Days of the month
 * @param time - Local time
 * @returns `YYYY-MM-DD HH:MM` strings
 */
function on(year: number, month: number, days: number[], time = "09:00"): string[] {
	let pad = (value: number) => String(value).padStart(2, "0");
	return days.map((day) => `${year}-${pad(month)}-${pad(day)} ${time}`);
}

/**
 * Every day, or every `step` days, between two dates inclusive, at 09:00.
 *
 * @param from - First day, `YYYY-MM-DD`
 * @param to - Last day, `YYYY-MM-DD`
 * @param step - Days between entries
 * @returns `YYYY-MM-DD 09:00` strings
 */
function everyDay(from: string, to: string, step = 1): string[] {
	let result: string[] = [];
	for (
		let day = Date.parse(`${from}T00:00:00Z`);
		day <= Date.parse(`${to}T00:00:00Z`);
		day += step * 86_400_000
	) {
		result.push(`${new Date(day).toISOString().slice(0, 10)} 09:00`);
	}
	return result;
}

/**
 * The integers from `from` to `to` inclusive.
 *
 * @param from - First
 * @param to - Last
 * @returns The range
 */
function range(from: number, to: number): number[] {
	return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

/** One RFC example: its event lines, the window it is expanded over, and what it lists. */
interface Example {
	name: string;
	lines: string[];
	until: string;
	expected: string[];
}

/** Every example of RFC 5545 §3.8.5.3, in the RFC's order; "or" variants are listed twice. */
const EXAMPLES: Example[] = [
	{
		name: "Daily for 10 occurrences",
		lines: ["DTSTART;TZID=America/New_York:19970902T090000", "RRULE:FREQ=DAILY;COUNT=10"],
		until: "2000-01-01",
		expected: on(1997, 9, range(2, 11)),
	},
	{
		name: "Daily until December 24, 1997",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=DAILY;UNTIL=19971224T000000Z",
		],
		until: "2000-01-01",
		expected: everyDay("1997-09-02", "1997-12-23"),
	},
	{
		name: "Every other day - forever",
		lines: ["DTSTART;TZID=America/New_York:19970902T090000", "RRULE:FREQ=DAILY;INTERVAL=2"],
		until: "1997-12-04",
		expected: everyDay("1997-09-02", "1997-12-03", 2),
	},
	{
		name: "Every 10 days, 5 occurrences",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=DAILY;INTERVAL=10;COUNT=5",
		],
		until: "2000-01-01",
		expected: [...on(1997, 9, [2, 12, 22]), ...on(1997, 10, [2, 12])],
	},
	{
		name: "Every day in January, for 3 years (YEARLY)",
		lines: [
			"DTSTART;TZID=America/New_York:19980101T090000",
			"RRULE:FREQ=YEARLY;UNTIL=20000131T140000Z;BYMONTH=1;BYDAY=SU,MO,TU,WE,TH,FR,SA",
		],
		until: "2001-01-01",
		expected: [1998, 1999, 2000].flatMap((year) => on(year, 1, range(1, 31))),
	},
	{
		name: "Every day in January, for 3 years (DAILY)",
		lines: [
			"DTSTART;TZID=America/New_York:19980101T090000",
			"RRULE:FREQ=DAILY;UNTIL=20000131T140000Z;BYMONTH=1",
		],
		until: "2001-01-01",
		expected: [1998, 1999, 2000].flatMap((year) => on(year, 1, range(1, 31))),
	},
	{
		name: "Weekly for 10 occurrences",
		lines: ["DTSTART;TZID=America/New_York:19970902T090000", "RRULE:FREQ=WEEKLY;COUNT=10"],
		until: "2000-01-01",
		expected: [
			...on(1997, 9, [2, 9, 16, 23, 30]),
			...on(1997, 10, [7, 14, 21, 28]),
			...on(1997, 11, [4]),
		],
	},
	{
		name: "Weekly until December 24, 1997",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=WEEKLY;UNTIL=19971224T000000Z",
		],
		until: "2000-01-01",
		expected: everyDay("1997-09-02", "1997-12-23", 7),
	},
	{
		name: "Every other week - forever",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=WEEKLY;INTERVAL=2;WKST=SU",
		],
		until: "1998-02-18",
		expected: [
			...on(1997, 9, [2, 16, 30]),
			...on(1997, 10, [14, 28]),
			...on(1997, 11, [11, 25]),
			...on(1997, 12, [9, 23]),
			...on(1998, 1, [6, 20]),
			...on(1998, 2, [3, 17]),
		],
	},
	{
		name: "Weekly on Tuesday and Thursday for five weeks (UNTIL)",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=WEEKLY;UNTIL=19971007T000000Z;WKST=SU;BYDAY=TU,TH",
		],
		until: "2000-01-01",
		expected: [...on(1997, 9, [2, 4, 9, 11, 16, 18, 23, 25, 30]), ...on(1997, 10, [2])],
	},
	{
		name: "Weekly on Tuesday and Thursday for five weeks (COUNT)",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=WEEKLY;COUNT=10;WKST=SU;BYDAY=TU,TH",
		],
		until: "2000-01-01",
		expected: [...on(1997, 9, [2, 4, 9, 11, 16, 18, 23, 25, 30]), ...on(1997, 10, [2])],
	},
	{
		name: "Every other week on Monday, Wednesday, and Friday until December 24, 1997",
		lines: [
			"DTSTART;TZID=America/New_York:19970901T090000",
			"RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=19971224T000000Z;WKST=SU;BYDAY=MO,WE,FR",
		],
		until: "2000-01-01",
		expected: [
			...on(1997, 9, [1, 3, 5, 15, 17, 19, 29]),
			...on(1997, 10, [1, 3, 13, 15, 17, 27, 29, 31]),
			...on(1997, 11, [10, 12, 14, 24, 26, 28]),
			...on(1997, 12, [8, 10, 12, 22]),
		],
	},
	{
		name: "Every other week on Tuesday and Thursday, for 8 occurrences",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=8;WKST=SU;BYDAY=TU,TH",
		],
		until: "2000-01-01",
		expected: [...on(1997, 9, [2, 4, 16, 18, 30]), ...on(1997, 10, [2, 14, 16])],
	},
	{
		name: "Monthly on the first Friday for 10 occurrences",
		lines: [
			"DTSTART;TZID=America/New_York:19970905T090000",
			"RRULE:FREQ=MONTHLY;COUNT=10;BYDAY=1FR",
		],
		until: "2000-01-01",
		expected: [
			...on(1997, 9, [5]),
			...on(1997, 10, [3]),
			...on(1997, 11, [7]),
			...on(1997, 12, [5]),
			...on(1998, 1, [2]),
			...on(1998, 2, [6]),
			...on(1998, 3, [6]),
			...on(1998, 4, [3]),
			...on(1998, 5, [1]),
			...on(1998, 6, [5]),
		],
	},
	{
		name: "Monthly on the first Friday until December 24, 1997",
		lines: [
			"DTSTART;TZID=America/New_York:19970905T090000",
			"RRULE:FREQ=MONTHLY;UNTIL=19971224T000000Z;BYDAY=1FR",
		],
		until: "2000-01-01",
		expected: [
			...on(1997, 9, [5]),
			...on(1997, 10, [3]),
			...on(1997, 11, [7]),
			...on(1997, 12, [5]),
		],
	},
	{
		name: "Every other month on the first and last Sunday of the month for 10 occurrences",
		lines: [
			"DTSTART;TZID=America/New_York:19970907T090000",
			"RRULE:FREQ=MONTHLY;INTERVAL=2;COUNT=10;BYDAY=1SU,-1SU",
		],
		until: "2000-01-01",
		expected: [
			...on(1997, 9, [7, 28]),
			...on(1997, 11, [2, 30]),
			...on(1998, 1, [4, 25]),
			...on(1998, 3, [1, 29]),
			...on(1998, 5, [3, 31]),
		],
	},
	{
		name: "Monthly on the second-to-last Monday of the month for 6 months",
		lines: [
			"DTSTART;TZID=America/New_York:19970922T090000",
			"RRULE:FREQ=MONTHLY;COUNT=6;BYDAY=-2MO",
		],
		until: "2000-01-01",
		expected: [
			...on(1997, 9, [22]),
			...on(1997, 10, [20]),
			...on(1997, 11, [17]),
			...on(1997, 12, [22]),
			...on(1998, 1, [19]),
			...on(1998, 2, [16]),
		],
	},
	{
		name: "Monthly on the third-to-the-last day of the month, forever",
		lines: ["DTSTART;TZID=America/New_York:19970928T090000", "RRULE:FREQ=MONTHLY;BYMONTHDAY=-3"],
		until: "1998-02-27",
		expected: [
			...on(1997, 9, [28]),
			...on(1997, 10, [29]),
			...on(1997, 11, [28]),
			...on(1997, 12, [29]),
			...on(1998, 1, [29]),
			...on(1998, 2, [26]),
		],
	},
	{
		name: "Monthly on the 2nd and 15th of the month for 10 occurrences",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=MONTHLY;COUNT=10;BYMONTHDAY=2,15",
		],
		until: "2000-01-01",
		expected: [
			...on(1997, 9, [2, 15]),
			...on(1997, 10, [2, 15]),
			...on(1997, 11, [2, 15]),
			...on(1997, 12, [2, 15]),
			...on(1998, 1, [2, 15]),
		],
	},
	{
		name: "Monthly on the first and last day of the month for 10 occurrences",
		lines: [
			"DTSTART;TZID=America/New_York:19970930T090000",
			"RRULE:FREQ=MONTHLY;COUNT=10;BYMONTHDAY=1,-1",
		],
		until: "2000-01-01",
		expected: [
			...on(1997, 9, [30]),
			...on(1997, 10, [1, 31]),
			...on(1997, 11, [1, 30]),
			...on(1997, 12, [1, 31]),
			...on(1998, 1, [1, 31]),
			...on(1998, 2, [1]),
		],
	},
	{
		name: "Every 18 months on the 10th thru 15th of the month for 10 occurrences",
		lines: [
			"DTSTART;TZID=America/New_York:19970910T090000",
			"RRULE:FREQ=MONTHLY;INTERVAL=18;COUNT=10;BYMONTHDAY=10,11,12,13,14,15",
		],
		until: "2000-01-01",
		expected: [...on(1997, 9, range(10, 15)), ...on(1999, 3, range(10, 13))],
	},
	{
		name: "Every Tuesday, every other month",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=MONTHLY;INTERVAL=2;BYDAY=TU",
		],
		until: "1998-04-01",
		expected: [
			...on(1997, 9, [2, 9, 16, 23, 30]),
			...on(1997, 11, [4, 11, 18, 25]),
			...on(1998, 1, [6, 13, 20, 27]),
			...on(1998, 3, [3, 10, 17, 24, 31]),
		],
	},
	{
		name: "Yearly in June and July for 10 occurrences",
		lines: [
			"DTSTART;TZID=America/New_York:19970610T090000",
			"RRULE:FREQ=YEARLY;COUNT=10;BYMONTH=6,7",
		],
		until: "2010-01-01",
		expected: range(1997, 2001).flatMap((year) => [...on(year, 6, [10]), ...on(year, 7, [10])]),
	},
	{
		name: "Every other year on January, February, and March for 10 occurrences",
		lines: [
			"DTSTART;TZID=America/New_York:19970310T090000",
			"RRULE:FREQ=YEARLY;INTERVAL=2;COUNT=10;BYMONTH=1,2,3",
		],
		until: "2010-01-01",
		expected: [
			...on(1997, 3, [10]),
			...[1999, 2001, 2003].flatMap((year) => [
				...on(year, 1, [10]),
				...on(year, 2, [10]),
				...on(year, 3, [10]),
			]),
		],
	},
	{
		name: "Every third year on the 1st, 100th, and 200th day for 10 occurrences",
		lines: [
			"DTSTART;TZID=America/New_York:19970101T090000",
			"RRULE:FREQ=YEARLY;INTERVAL=3;COUNT=10;BYYEARDAY=1,100,200",
		],
		until: "2010-01-01",
		expected: [
			...on(1997, 1, [1]),
			...on(1997, 4, [10]),
			...on(1997, 7, [19]),
			...on(2000, 1, [1]),
			...on(2000, 4, [9]),
			...on(2000, 7, [18]),
			...on(2003, 1, [1]),
			...on(2003, 4, [10]),
			...on(2003, 7, [19]),
			...on(2006, 1, [1]),
		],
	},
	{
		name: "Every 20th Monday of the year, forever",
		lines: ["DTSTART;TZID=America/New_York:19970519T090000", "RRULE:FREQ=YEARLY;BYDAY=20MO"],
		until: "1999-12-31",
		expected: [...on(1997, 5, [19]), ...on(1998, 5, [18]), ...on(1999, 5, [17])],
	},
	{
		name: "Monday of week number 20, forever",
		lines: [
			"DTSTART;TZID=America/New_York:19970512T090000",
			"RRULE:FREQ=YEARLY;BYWEEKNO=20;BYDAY=MO",
		],
		until: "1999-12-31",
		expected: [...on(1997, 5, [12]), ...on(1998, 5, [11]), ...on(1999, 5, [17])],
	},
	{
		name: "Every Thursday in March, forever",
		lines: [
			"DTSTART;TZID=America/New_York:19970313T090000",
			"RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=TH",
		],
		until: "1999-12-31",
		expected: [
			...on(1997, 3, [13, 20, 27]),
			...on(1998, 3, [5, 12, 19, 26]),
			...on(1999, 3, [4, 11, 18, 25]),
		],
	},
	{
		name: "Every Thursday, but only during June, July, and August, forever",
		lines: [
			"DTSTART;TZID=America/New_York:19970605T090000",
			"RRULE:FREQ=YEARLY;BYDAY=TH;BYMONTH=6,7,8",
		],
		until: "1999-12-31",
		expected: [
			...on(1997, 6, [5, 12, 19, 26]),
			...on(1997, 7, [3, 10, 17, 24, 31]),
			...on(1997, 8, [7, 14, 21, 28]),
			...on(1998, 6, [4, 11, 18, 25]),
			...on(1998, 7, [2, 9, 16, 23, 30]),
			...on(1998, 8, [6, 13, 20, 27]),
			...on(1999, 6, [3, 10, 17, 24]),
			...on(1999, 7, [1, 8, 15, 22, 29]),
			...on(1999, 8, [5, 12, 19, 26]),
		],
	},
	{
		name: "Every Friday the 13th, forever",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"EXDATE;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=MONTHLY;BYDAY=FR;BYMONTHDAY=13",
		],
		until: "2000-12-31",
		expected: [
			...on(1998, 2, [13]),
			...on(1998, 3, [13]),
			...on(1998, 11, [13]),
			...on(1999, 8, [13]),
			...on(2000, 10, [13]),
		],
	},
	{
		name: "The first Saturday that follows the first Sunday of the month, forever",
		lines: [
			"DTSTART;TZID=America/New_York:19970913T090000",
			"RRULE:FREQ=MONTHLY;BYDAY=SA;BYMONTHDAY=7,8,9,10,11,12,13",
		],
		until: "1998-06-30",
		expected: [
			...on(1997, 9, [13]),
			...on(1997, 10, [11]),
			...on(1997, 11, [8]),
			...on(1997, 12, [13]),
			...on(1998, 1, [10]),
			...on(1998, 2, [7]),
			...on(1998, 3, [7]),
			...on(1998, 4, [11]),
			...on(1998, 5, [9]),
			...on(1998, 6, [13]),
		],
	},
	{
		name: "Every 4 years, the first Tuesday after a Monday in November, forever",
		lines: [
			"DTSTART;TZID=America/New_York:19961105T090000",
			"RRULE:FREQ=YEARLY;INTERVAL=4;BYMONTH=11;BYDAY=TU;BYMONTHDAY=2,3,4,5,6,7,8",
		],
		until: "2004-12-31",
		expected: [...on(1996, 11, [5]), ...on(2000, 11, [7]), ...on(2004, 11, [2])],
	},
	{
		name: "The third instance into the month of one of Tuesday, Wednesday, or Thursday",
		lines: [
			"DTSTART;TZID=America/New_York:19970904T090000",
			"RRULE:FREQ=MONTHLY;COUNT=3;BYDAY=TU,WE,TH;BYSETPOS=3",
		],
		until: "2000-01-01",
		expected: [...on(1997, 9, [4]), ...on(1997, 10, [7]), ...on(1997, 11, [6])],
	},
	{
		name: "The second-to-last weekday of the month",
		lines: [
			"DTSTART;TZID=America/New_York:19970929T090000",
			"RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-2",
		],
		until: "1998-03-31",
		expected: [
			...on(1997, 9, [29]),
			...on(1997, 10, [30]),
			...on(1997, 11, [27]),
			...on(1997, 12, [30]),
			...on(1998, 1, [29]),
			...on(1998, 2, [26]),
			...on(1998, 3, [30]),
		],
	},
	{
		name: "Every 3 hours from 9:00 AM to 5:00 PM on a specific day (UNTIL as printed)",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=HOURLY;INTERVAL=3;UNTIL=19970902T170000Z",
		],
		until: "2000-01-01",
		expected: on(1997, 9, [2], "09:00").concat(on(1997, 9, [2], "12:00")),
	},
	{
		name: "Every 3 hours from 9:00 AM to 5:00 PM on a specific day (UNTIL at 5:00 PM EDT)",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=HOURLY;INTERVAL=3;UNTIL=19970902T210000Z",
		],
		until: "2000-01-01",
		expected: ["09:00", "12:00", "15:00"].flatMap((time) => on(1997, 9, [2], time)),
	},
	{
		name: "Every 15 minutes for 6 occurrences",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=MINUTELY;INTERVAL=15;COUNT=6",
		],
		until: "2000-01-01",
		expected: ["09:00", "09:15", "09:30", "09:45", "10:00", "10:15"].flatMap((time) =>
			on(1997, 9, [2], time),
		),
	},
	{
		name: "Every hour and a half for 4 occurrences",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=MINUTELY;INTERVAL=90;COUNT=4",
		],
		until: "2000-01-01",
		expected: ["09:00", "10:30", "12:00", "13:30"].flatMap((time) => on(1997, 9, [2], time)),
	},
	{
		name: "Every 20 minutes from 9:00 AM to 4:40 PM every day (DAILY)",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=DAILY;BYHOUR=9,10,11,12,13,14,15,16;BYMINUTE=0,20,40",
		],
		until: "1997-09-04",
		expected: [2, 3].flatMap((day) =>
			range(9, 16).flatMap((hour) =>
				["00", "20", "40"].flatMap((minute) =>
					on(1997, 9, [day], `${String(hour).padStart(2, "0")}:${minute}`),
				),
			),
		),
	},
	{
		name: "Every 20 minutes from 9:00 AM to 4:40 PM every day (MINUTELY)",
		lines: [
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=MINUTELY;INTERVAL=20;BYHOUR=9,10,11,12,13,14,15,16",
		],
		until: "1997-09-04",
		expected: [2, 3].flatMap((day) =>
			range(9, 16).flatMap((hour) =>
				["00", "20", "40"].flatMap((minute) =>
					on(1997, 9, [day], `${String(hour).padStart(2, "0")}:${minute}`),
				),
			),
		),
	},
	{
		name: "An example where the days generated makes a difference because of WKST (MO)",
		lines: [
			"DTSTART;TZID=America/New_York:19970805T090000",
			"RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=MO",
		],
		until: "2000-01-01",
		expected: on(1997, 8, [5, 10, 19, 24]),
	},
	{
		name: "An example where the days generated makes a difference because of WKST (SU)",
		lines: [
			"DTSTART;TZID=America/New_York:19970805T090000",
			"RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=SU",
		],
		until: "2000-01-01",
		expected: on(1997, 8, [5, 17, 19, 31]),
	},
	{
		name: "An example where an invalid date (i.e., February 30) is ignored",
		lines: [
			"DTSTART;TZID=America/New_York:20070115T090000",
			"RRULE:FREQ=MONTHLY;BYMONTHDAY=15,30;COUNT=5",
		],
		until: "2010-01-01",
		expected: [...on(2007, 1, [15, 30]), ...on(2007, 2, [15]), ...on(2007, 3, [15, 30])],
	},
];

describe("RFC 5545 §3.8.5.3 examples", () => {
	test.each(EXAMPLES)("$name", ({ lines, until, expected }) => {
		let { calendar, event } = readEvent(lines);
		let from = Date.UTC(1990, 0, 1);
		let to = Date.parse(`${until}T00:00:00-05:00`);
		let result = unwrap(occurrences(event, { from, to, calendar }));
		expect(result.map((occurrence) => local(occurrence.start))).toEqual(expected);
	});

	test("expands the examples through a skipped window the same way", () => {
		let { calendar, event } = readEvent([
			"DTSTART;TZID=America/New_York:19970902T090000",
			"RRULE:FREQ=MONTHLY;INTERVAL=2;BYDAY=TU",
		]);
		let from = Date.parse("1998-03-01T00:00:00-05:00");
		let to = Date.parse("1998-04-01T00:00:00-05:00");
		let result = unwrap(occurrences(event, { from, to, calendar }));
		expect(result.map((occurrence) => local(occurrence.start))).toEqual(
			on(1998, 3, [3, 10, 17, 24, 31]),
		);
	});
});

describe("parseRecurrence", () => {
	test("reads every part", () => {
		let rule = unwrap(
			parseRecurrence(
				"FREQ=YEARLY;INTERVAL=2;UNTIL=20001231T000000Z;BYSECOND=0;BYMINUTE=30;BYHOUR=9;BYDAY=-1SU,MO;BYMONTHDAY=-3;BYYEARDAY=100;BYWEEKNO=20;BYMONTH=3;BYSETPOS=1;WKST=SU",
			),
		);
		expect(rule).toEqual({
			frequency: "YEARLY",
			interval: 2,
			until: {
				type: "date-time",
				wall: { year: 2000, month: 12, day: 31, hour: 0, minute: 0, second: 0 },
				zone: "utc",
			},
			bySecond: [0],
			byMinute: [30],
			byHour: [9],
			byDay: [{ weekday: "SU", ordinal: -1 }, { weekday: "MO" }],
			byMonthDay: [-3],
			byYearDay: [100],
			byWeekNumber: [20],
			byMonth: [3],
			bySetPosition: [1],
			weekStart: "SU",
		});
	});

	test("accepts lower case and a trailing semicolon", () => {
		expect(unwrap(parseRecurrence("freq=daily;count=3;"))).toEqual({
			frequency: "DAILY",
			count: 3,
		});
	});

	test("reads a DATE UNTIL", () => {
		expect(unwrap(parseRecurrence("FREQ=DAILY;UNTIL=19971224")).until).toEqual({
			type: "date",
			year: 1997,
			month: 12,
			day: 24,
		});
	});

	test.each([
		["no FREQ", "COUNT=3"],
		["an unknown FREQ", "FREQ=FORTNIGHTLY"],
		["COUNT with UNTIL", "FREQ=DAILY;COUNT=3;UNTIL=19971224T000000Z"],
		["a repeated part", "FREQ=DAILY;FREQ=WEEKLY"],
		["an unknown part", "FREQ=DAILY;RSCALE=GREGORIAN"],
		["a zero interval", "FREQ=DAILY;INTERVAL=0"],
		["an hour out of range", "FREQ=DAILY;BYHOUR=24"],
		["a negative month", "FREQ=YEARLY;BYMONTH=-1"],
		["a zero month day", "FREQ=MONTHLY;BYMONTHDAY=0"],
		["a malformed weekday", "FREQ=WEEKLY;BYDAY=XX"],
		["a zero ordinal", "FREQ=MONTHLY;BYDAY=0MO"],
		["a part without =", "FREQ=DAILY;COUNT"],
	])("refuses %s", (_, value) => {
		let result = parseRecurrence(value);
		expect(isFailure(result) && result.error).toBeInstanceOf(RecurrenceRuleError);
	});
});

describe("stringifyRecurrence", () => {
	test("writes FREQ, INTERVAL, COUNT, the BY parts in order, then WKST", () => {
		expect(
			stringifyRecurrence({
				frequency: "MONTHLY",
				weekStart: "SU",
				bySetPosition: [-1],
				byMonthDay: [28, 29, 30, 31],
				count: 3,
				interval: 1,
			}),
		).toBe("FREQ=MONTHLY;INTERVAL=1;COUNT=3;BYMONTHDAY=28,29,30,31;BYSETPOS=-1;WKST=SU");
	});

	test("round trips every RFC example's rule", () => {
		for (let example of EXAMPLES) {
			let written = example.lines.find((line) => line.startsWith("RRULE:"))?.slice(6) ?? "";
			let rule = unwrap(parseRecurrence(written));
			expect(unwrap(parseRecurrence(stringifyRecurrence(rule)))).toEqual(rule);
		}
	});

	test("writes UNTIL as UTC, floating or a date", () => {
		expect(
			stringifyRecurrence({
				frequency: "DAILY",
				until: { type: "date", year: 1997, month: 12, day: 24 },
			}),
		).toBe("FREQ=DAILY;UNTIL=19971224");
	});
});

describe("occurrences", () => {
	test("stops at the limit on a rule with no end", () => {
		let { event } = readEvent(["DTSTART:20260101T000000Z", "RRULE:FREQ=SECONDLY"]);
		let result = unwrap(occurrences(event, { from: 0, to: Date.UTC(2100, 0, 1), limit: 5 }));
		expect(result.map((occurrence) => occurrence.start)).toEqual(
			[0, 1, 2, 3, 4].map((second) => Date.UTC(2026, 0, 1, 0, 0, second)),
		);
	});

	test("applies the default limit of 1000", () => {
		let { event } = readEvent(["DTSTART:20260101T000000Z", "RRULE:FREQ=MINUTELY"]);
		expect(unwrap(occurrences(event, { from: 0, to: Date.UTC(2100, 0, 1) }))).toHaveLength(1000);
	});

	test("jumps to a window far after the start", () => {
		let { event } = readEvent(["DTSTART:19700101T120000Z", "RRULE:FREQ=HOURLY;INTERVAL=5"]);
		let from = Date.UTC(2026, 8, 24);
		let result = unwrap(occurrences(event, { from, to: from + 86_400_000 }));
		expect(result.length).toBeGreaterThanOrEqual(4);
		for (let occurrence of result)
			expect((occurrence.start - Date.UTC(1970, 0, 1, 12)) % (5 * 3_600_000)).toBe(0);
	});

	test("includes an occurrence still running when the window opens", () => {
		let { event } = readEvent(["DTSTART:20260101T230000Z", "DURATION:PT2H", "RRULE:FREQ=DAILY"]);
		let from = Date.UTC(2026, 0, 3, 0, 30);
		let result = unwrap(occurrences(event, { from, to: from + 3_600_000 }));
		expect(result).toEqual([{ start: Date.UTC(2026, 0, 2, 23), end: Date.UTC(2026, 0, 3, 1) }]);
	});

	test("returns a single event without a rule when it overlaps", () => {
		let { event } = readEvent(["DTSTART:20260923T100000Z", "DTEND:20260923T120000Z"]);
		expect(
			unwrap(occurrences(event, { from: Date.UTC(2026, 8, 23, 11), to: Date.UTC(2026, 8, 24) })),
		).toEqual([{ start: Date.UTC(2026, 8, 23, 10), end: Date.UTC(2026, 8, 23, 12) }]);
		expect(
			unwrap(occurrences(event, { from: Date.UTC(2026, 8, 23, 12), to: Date.UTC(2026, 8, 24) })),
		).toEqual([]);
	});

	test("returns nothing for an empty window", () => {
		let { event } = readEvent(["DTSTART:20260923T100000Z"]);
		expect(unwrap(occurrences(event, { from: 10, to: 10 }))).toEqual([]);
	});

	test("merges RDATEs, periods included, and removes EXDATEs", () => {
		let { event } = readEvent([
			"DTSTART:20260101T100000Z",
			"DURATION:PT1H",
			"RRULE:FREQ=DAILY;COUNT=3",
			"RDATE:20260110T100000Z,20260102T100000Z",
			"RDATE;VALUE=PERIOD:20260115T080000Z/PT30M",
			"EXDATE:20260103T100000Z",
		]);
		let result = unwrap(occurrences(event, { from: 0, to: Date.UTC(2027, 0, 1) }));
		expect(result).toEqual([
			{ start: Date.UTC(2026, 0, 1, 10), end: Date.UTC(2026, 0, 1, 11) },
			{ start: Date.UTC(2026, 0, 2, 10), end: Date.UTC(2026, 0, 2, 11) },
			{ start: Date.UTC(2026, 0, 10, 10), end: Date.UTC(2026, 0, 10, 11) },
			{ start: Date.UTC(2026, 0, 15, 8), end: Date.UTC(2026, 0, 15, 8, 30) },
		]);
	});

	test("keeps the exact length of DTEND and the nominal length of DURATION across DST", () => {
		let exact = readEvent([
			"DTSTART;TZID=America/New_York:20261031T120000",
			"DTEND;TZID=America/New_York:20261101T120000",
			"RRULE:FREQ=DAILY;COUNT=2",
		]).event;
		let nominal = readEvent([
			"DTSTART;TZID=America/New_York:20261031T120000",
			"DURATION:P1D",
			"RRULE:FREQ=DAILY;COUNT=2",
		]).event;
		let window = { from: 0, to: Date.UTC(2027, 0, 1) };
		let exactFirst = unwrap(occurrences(exact, window))[0];
		let nominalFirst = unwrap(occurrences(nominal, window))[0];
		expect(exactFirst && (exactFirst.end - exactFirst.start) / 3_600_000).toBe(25);
		expect(nominalFirst && local(nominalFirst.end)).toBe("2026-11-01 12:00");
	});

	test("reads all-day events in the zone given, one day long by default", () => {
		let { event } = readEvent(["DTSTART;VALUE=DATE:19971102", "RRULE:FREQ=YEARLY"]);
		let result = unwrap(
			occurrences(event, {
				from: Date.UTC(1998, 0, 1),
				to: Date.UTC(1999, 0, 1),
				timeZone: NEW_YORK,
			}),
		);
		expect(result).toEqual([
			{
				start: Date.parse("1998-11-02T00:00:00-05:00"),
				end: Date.parse("1998-11-03T00:00:00-05:00"),
			},
		]);
	});

	test("reads floating times in UTC without a zone", () => {
		let { event } = readEvent(["DTSTART:20260923T100000"]);
		expect(unwrap(occurrences(event, { from: 0, to: Date.UTC(2027, 0, 1) }))).toEqual([
			{ start: Date.UTC(2026, 8, 23, 10), end: Date.UTC(2026, 8, 23, 10) },
		]);
	});

	test("moves a start in a DST gap forward by the gap and takes the first of a repeated hour", () => {
		let { event } = readEvent([
			"DTSTART;TZID=America/New_York:20260308T023000",
			"RRULE:FREQ=YEARLY;COUNT=1",
		]);
		let [gap] = unwrap(occurrences(event, { from: 0, to: Date.UTC(2027, 0, 1) }));
		expect(gap?.start).toBe(Date.UTC(2026, 2, 8, 7, 30));
		let repeated = readEvent(["DTSTART;TZID=America/New_York:20261101T013000"]).event;
		let [first] = unwrap(occurrences(repeated, { from: 0, to: Date.UTC(2027, 0, 1) }));
		expect(first?.start).toBe(Date.UTC(2026, 10, 1, 5, 30));
	});

	test("clamps a monthly day to the month's last day with BYSETPOS=-1", () => {
		let { event } = readEvent([
			"DTSTART:20260131T020000Z",
			"RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1",
		]);
		let result = unwrap(occurrences(event, { from: 0, to: Date.UTC(2026, 4, 1) }));
		expect(
			result.map((occurrence) => new Date(occurrence.start).toISOString().slice(0, 10)),
		).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
	});

	test("resolves a TZID through the calendar's VTIMEZONE", () => {
		let { event, calendar } = readEvent(["DTSTART;TZID=Custom:20260101T090000"]);
		calendar.timeZones.push({
			tzid: "Custom",
			observances: [
				{
					kind: "STANDARD",
					start: { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
					offsetFrom: 90,
					offsetTo: 90,
				},
			],
		});
		expect(
			unwrap(occurrences(event, { from: 0, to: Date.UTC(2027, 0, 1), calendar }))[0]?.start,
		).toBe(Date.UTC(2026, 0, 1, 7, 30));
	});

	test("fails on a TZID nothing resolves and on an invalid typed rule", () => {
		let { event } = readEvent(["DTSTART;TZID=Nowhere/Special:20260101T090000"]);
		expect(isFailure(occurrences(event, { from: 0, to: 1e13 }))).toBe(true);
		let invalid: ICalendar.Event = {
			...event,
			start: { type: "date", year: 2026, month: 1, day: 1 },
			recurrence: { frequency: "DAILY", interval: 0 },
		};
		let result = occurrences(invalid, { from: 0, to: 1e13 });
		expect(isFailure(result) && result.error).toBeInstanceOf(RecurrenceRuleError);
	});

	test("expands a rule that never matches without running away", () => {
		let { event } = readEvent([
			"DTSTART:20260101T000000Z",
			"RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30",
		]);
		let result = occurrences(event, { from: 0, to: Date.UTC(2500, 0, 1) });
		expect(isSuccess(result) && result.data).toEqual([
			{ start: Date.UTC(2026, 0, 1), end: Date.UTC(2026, 0, 1) },
		]);
	});
});
