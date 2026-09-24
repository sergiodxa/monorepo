/**
 * Checks the calendar reader and writer: the exact text a feed is written as, round trips of
 * every typed field, untyped components and properties kept verbatim, warnings for what a
 * lenient reader tolerates, structural failures with their line, and the response helper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { ICalendar } from "./index.js";

import {
	calendarResponse,
	escapeText,
	ICalendarParseError,
	MEDIA_TYPE,
	parse,
	parseAll,
	stringify,
	toInstant,
	utc,
} from "./index.js";

/**
 * A calendar with nothing in it but what a test adds.
 *
 * @param overrides - Fields to set
 * @returns The calendar
 */
function calendar(overrides: Partial<ICalendar.Calendar> = {}): ICalendar.Calendar {
	return {
		productId: "-//test//EN",
		timeZones: [],
		events: [],
		components: [],
		properties: [],
		...overrides,
	};
}

/**
 * Wraps content lines in a calendar's text.
 *
 * @param lines - Lines between `BEGIN:VCALENDAR` and `END:VCALENDAR`
 * @returns The calendar text
 */
function text(lines: string[]): string {
	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//test//EN",
		...lines,
		"END:VCALENDAR",
		"",
	].join("\r\n");
}

/** An event with only the fields the writer requires. */
const BARE: ICalendar.Event = {
	uid: "42@uptime",
	dtstamp: new Date(Date.UTC(2026, 8, 20, 8, 15)),
	start: utc(Date.UTC(2026, 8, 23, 10)),
	properties: [],
};

/** A maintenance window as a feed would publish it. */
const MAINTENANCE: ICalendar.Event = {
	...BARE,
	end: utc(Date.UTC(2026, 8, 23, 12)),
	summary: "Database upgrade; API, dashboard",
	sequence: 3,
};

describe("stringify", () => {
	test("writes a feed as CRLF lines with VERSION first and the X- aliases", () => {
		let written = stringify(
			calendar({
				name: "Status: Maintenance",
				url: "https://status.example.com/",
				refreshInterval: { hours: 1 },
				events: [MAINTENANCE],
			}),
		);
		expect(written).toBe(
			[
				"BEGIN:VCALENDAR",
				"VERSION:2.0",
				"PRODID:-//test//EN",
				"NAME:Status: Maintenance",
				"X-WR-CALNAME:Status: Maintenance",
				"URL:https://status.example.com/",
				"REFRESH-INTERVAL;VALUE=DURATION:PT1H",
				"X-PUBLISHED-TTL:PT1H",
				"BEGIN:VEVENT",
				"UID:42@uptime",
				"DTSTAMP:20260920T081500Z",
				"DTSTART:20260923T100000Z",
				"DTEND:20260923T120000Z",
				"SUMMARY:Database upgrade\\; API\\, dashboard",
				"SEQUENCE:3",
				"END:VEVENT",
				"END:VCALENDAR",
				"",
			].join("\r\n"),
		);
	});

	test("folds long lines at 75 octets", () => {
		let description = "Affected: ".concat("monitor-é ".repeat(40));
		let written = stringify(calendar({ events: [{ ...MAINTENANCE, description }] }));
		for (let line of written.split("\r\n"))
			expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
		expect(unwrap(parse(written)).calendar.events[0]?.description).toBe(description);
	});

	test("writes DURATION when there is no end, and the end when both are set", () => {
		let withDuration = { ...BARE, duration: { hours: 2 } };
		expect(stringify(calendar({ events: [withDuration] }))).toContain("\r\nDURATION:PT2H\r\n");
		let both = stringify(calendar({ events: [{ ...MAINTENANCE, duration: { hours: 5 } }] }));
		expect(both).toContain("DTEND:");
		expect(both).not.toContain("DURATION:");
	});

	test("writes a zoned recurring event with its VTIMEZONE", () => {
		let written = stringify(
			calendar({
				timeZones: [
					{
						tzid: "Europe/Madrid",
						observances: [
							{
								kind: "STANDARD",
								start: { year: 1996, month: 10, day: 27, hour: 3, minute: 0, second: 0 },
								recurrence: {
									frequency: "YEARLY",
									byMonth: [10],
									byDay: [{ weekday: "SU", ordinal: -1 }],
								},
								offsetFrom: 120,
								offsetTo: 60,
								name: "CET",
							},
						],
					},
				],
				events: [
					{
						...BARE,
						start: {
							type: "date-time",
							wall: { year: 2026, month: 9, day: 23, hour: 2, minute: 0, second: 0 },
							zone: { tzid: "Europe/Madrid" },
						},
						duration: { hours: 2 },
						recurrence: { frequency: "MONTHLY", byMonthDay: [28, 29, 30, 31], bySetPosition: [-1] },
					},
				],
			}),
		);
		expect(written).toContain(
			"BEGIN:VTIMEZONE\r\nTZID:Europe/Madrid\r\nBEGIN:STANDARD\r\nDTSTART:19961027T030000\r\nRRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nTZNAME:CET\r\nEND:STANDARD\r\nEND:VTIMEZONE",
		);
		expect(written).toContain("DTSTART;TZID=Europe/Madrid:20260923T020000\r\n");
		expect(written).toContain("RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1\r\n");
	});

	test("groups RDATE and EXDATE values that share their parameters", () => {
		let written = stringify(
			calendar({
				events: [
					{
						...MAINTENANCE,
						recurrenceDates: [
							utc(Date.UTC(2026, 9, 1)),
							utc(Date.UTC(2026, 9, 2)),
							{ type: "period", start: utc(Date.UTC(2026, 9, 3)), duration: { hours: 1 } },
						],
						exceptionDates: [{ type: "date", year: 2026, month: 9, day: 30 }],
					},
				],
			}),
		);
		expect(written).toContain("RDATE:20261001T000000Z,20261002T000000Z\r\n");
		expect(written).toContain("RDATE;VALUE=PERIOD:20261003T000000Z/PT1H\r\n");
		expect(written).toContain("EXDATE;VALUE=DATE:20260930\r\n");
	});

	test("round trips every typed field", () => {
		let event: ICalendar.Event = {
			...MAINTENANCE,
			description: "Line one\nLine two, with a comma",
			location: "Region: eu-west",
			url: "https://status.example.com/maintenance/42",
			status: "CONFIRMED",
			transparency: "TRANSPARENT",
			created: new Date(Date.UTC(2026, 8, 1)),
			lastModified: new Date(Date.UTC(2026, 8, 2)),
			categories: ["Maintenance", "Database, primary"],
			recurrence: {
				frequency: "WEEKLY",
				byDay: [{ weekday: "MO" }],
				until: utc(Date.UTC(2026, 11, 31)),
			},
			recurrenceDates: [utc(Date.UTC(2026, 9, 1, 10))],
			exceptionDates: [utc(Date.UTC(2026, 8, 28, 10))],
			recurrenceId: utc(Date.UTC(2026, 8, 23, 10)),
			organizer: { address: "mailto:ops@example.com", name: "Ops; On Call" },
			attendees: [
				{
					address: "mailto:a@example.com",
					name: "Doe, Jane",
					role: "CHAIR",
					participation: "ACCEPTED",
					rsvp: false,
				},
				{
					address: "mailto:b@example.com",
					parameters: { CUTYPE: ["ROOM"], "X-NOTE": ['say "hi"\nthere'] },
				},
			],
			alarms: [
				{ action: "DISPLAY", trigger: { before: { minutes: 15 } }, description: "Starting soon" },
				{
					action: "DISPLAY",
					trigger: { before: { negative: true, minutes: 5 }, related: "END" },
					description: "Over",
				},
				{
					action: "EMAIL",
					trigger: { at: new Date(Date.UTC(2026, 8, 22)) },
					summary: "Tomorrow",
					description: "Maintenance tomorrow",
					attendees: [{ address: "mailto:c@example.com" }],
					repeat: { count: 2, every: { hours: 1 } },
				},
			],
			properties: [
				{ name: "X-UPTIME-SCOPE", parameters: { MONITOR: ["http", "tcp"] }, value: "all" },
			],
		};
		let original = calendar({
			method: "PUBLISH",
			name: "Maintenance",
			description: "Planned work",
			url: "https://status.example.com/",
			refreshInterval: { hours: 1 },
			events: [event],
			properties: [{ name: "CALSCALE", parameters: {}, value: "GREGORIAN" }],
		});
		let { calendar: read, warnings } = unwrap(parse(stringify(original)));
		expect(warnings).toEqual([]);
		expect(read).toEqual(original);
	});

	test("writes unknown components and X- properties back verbatim", () => {
		let source = text([
			"X-WR-TIMEZONE:Europe/Madrid",
			"BEGIN:VTODO",
			"UID:todo@test",
			'X-CUSTOM;X-PARAM="a:b":raw\\,value',
			"BEGIN:X-NESTED",
			"X-A:1",
			"END:X-NESTED",
			"END:VTODO",
		]);
		let first = unwrap(parse(source)).calendar;
		expect(first.properties).toEqual([
			{ name: "X-WR-TIMEZONE", parameters: {}, value: "Europe/Madrid" },
		]);
		expect(first.components[0]).toEqual({
			name: "VTODO",
			properties: [
				{ name: "UID", parameters: {}, value: "todo@test" },
				{ name: "X-CUSTOM", parameters: { "X-PARAM": ["a:b"] }, value: "raw\\,value" },
			],
			components: [
				{
					name: "X-NESTED",
					properties: [{ name: "X-A", parameters: {}, value: "1" }],
					components: [],
				},
			],
		});
		expect(stringify(first)).toBe(source);
	});
});

describe("parse", () => {
	test("reads NAME, X-WR-CALNAME and X-PUBLISHED-TTL into the RFC 7986 fields", () => {
		let { calendar: read } = unwrap(
			parse(
				text([
					"X-WR-CALNAME:Old name",
					"X-WR-CALDESC:Old description",
					"X-PUBLISHED-TTL:PT6H",
					"COLOR:red",
				]),
			),
		);
		expect(read).toMatchObject({
			name: "Old name",
			description: "Old description",
			refreshInterval: { hours: 6 },
		});
		expect(read.properties).toEqual([{ name: "COLOR", parameters: {}, value: "red" }]);
		let preferred = unwrap(parse(text(["NAME:New", "X-WR-CALNAME:Old"]))).calendar;
		expect(preferred.name).toBe("New");
	});

	test("reads LF-only text", () => {
		let source = text([
			"BEGIN:VEVENT",
			"UID:1",
			"DTSTAMP:20260101T000000Z",
			"DTSTART:20260101T000000Z",
			"END:VEVENT",
		]);
		expect(unwrap(parse(source.replaceAll("\r\n", "\n"))).calendar.events).toHaveLength(1);
	});

	test("warns about a missing UID, DTSTAMP, PRODID and VERSION, and writes them back missing", () => {
		let source = [
			"BEGIN:VCALENDAR",
			"BEGIN:VEVENT",
			"DTSTART:20260101T000000Z",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");
		let { calendar: read, warnings } = unwrap(parse(source));
		expect(warnings).toEqual([
			"Line 1: VCALENDAR has no PRODID",
			"Line 1: VCALENDAR has no VERSION",
			"Line 2: VEVENT has no UID",
			"Line 2: VEVENT has no DTSTAMP",
		]);
		let [event] = read.events;
		expect(event?.uid).toBe("");
		expect(Number.isNaN(event?.dtstamp.getTime())).toBe(true);
		let written = stringify(read);
		expect(written).not.toContain("UID:");
		expect(written).not.toContain("DTSTAMP:");
	});

	test("keeps an event without DTSTART as an untyped component", () => {
		let { calendar: read, warnings } = unwrap(
			parse(text(["BEGIN:VEVENT", "UID:1", "DTSTAMP:20260101T000000Z", "END:VEVENT"])),
		);
		expect(read.events).toEqual([]);
		expect(read.components[0]?.name).toBe("VEVENT");
		expect(warnings).toEqual([
			"Line 4: VEVENT without a readable DTSTART was kept as an untyped component",
		]);
	});

	test("keeps values that do not parse in properties with a warning", () => {
		let { calendar: read, warnings } = unwrap(
			parse(
				text([
					"BEGIN:VEVENT",
					"UID:1",
					"DTSTAMP:20260101T000000Z",
					"DTSTART:20260101T000000Z",
					"STATUS:MAYBE",
					"RRULE:FREQ=DAILY;RSCALE=GREGORIAN",
					"DTEND:tomorrow",
					"END:VEVENT",
				]),
			),
		);
		expect(read.events[0]?.properties.map((property) => property.name)).toEqual([
			"STATUS",
			"RRULE",
			"DTEND",
		]);
		expect(warnings).toHaveLength(3);
		expect(warnings[1]).toContain("RSCALE is not a recurrence rule part");
	});

	test("drops an alarm it cannot fire", () => {
		let { calendar: read, warnings } = unwrap(
			parse(
				text([
					"BEGIN:VEVENT",
					"UID:1",
					"DTSTAMP:20260101T000000Z",
					"DTSTART:20260101T000000Z",
					"BEGIN:VALARM",
					"ACTION:DISPLAY",
					"END:VALARM",
					"END:VEVENT",
				]),
			),
		);
		expect(read.events[0]?.alarms).toBeUndefined();
		expect(warnings).toEqual(["Line 8: VALARM without a readable ACTION and TRIGGER was dropped"]);
	});

	test("reads only the first of several calendars", () => {
		let source = text(["NAME:One"]) + text(["NAME:Two"]);
		expect(unwrap(parse(source)).calendar.name).toBe("One");
		expect(unwrap(parseAll(source)).map((parsed) => parsed.calendar.name)).toEqual(["One", "Two"]);
	});

	test.each([
		[
			"an END without BEGIN",
			["BEGIN:VCALENDAR", "END:VCALENDAR", "END:VEVENT"],
			3,
			"END:VEVENT has no BEGIN",
		],
		[
			"a mismatched END",
			["BEGIN:VCALENDAR", "BEGIN:VEVENT", "END:VCALENDAR"],
			3,
			"END:VCALENDAR closes BEGIN:VEVENT",
		],
		[
			"an unclosed BEGIN",
			["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:1"],
			2,
			"BEGIN:VEVENT is never closed",
		],
		[
			"a line without a colon",
			["BEGIN:VCALENDAR", "VERSION:2.0", "SUMMARY;LANGUAGE=en", "END:VCALENDAR"],
			3,
			'SUMMARY has no ":"',
		],
		["content outside a VCALENDAR", ["VERSION:2.0"], 1, "VERSION sits outside a VCALENDAR"],
		["another component at the top", ["BEGIN:VEVENT", "END:VEVENT"], 1, "expected BEGIN:VCALENDAR"],
		["no VCALENDAR at all", [""], 1, "holds no VCALENDAR"],
	])("fails on %s with its line", (_, lines, line, message) => {
		let result = parse(lines.join("\r\n"));
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(ICalendarParseError);
		expect(result.error.line).toBe(line);
		expect(result.error.message).toContain(message);
	});

	test("counts physical lines, folded ones included, in failures", () => {
		let result = parse(
			["BEGIN:VCALENDAR", "DESCRIPTION:a", " b", " c", "BROKEN", "END:VCALENDAR"].join("\r\n"),
		);
		expect(isFailure(result) && result.error.line).toBe(5);
	});
});

describe("toInstant and utc", () => {
	test("utc writes an instant as a UTC DATE-TIME, dropping milliseconds", () => {
		expect(utc(new Date("2026-09-23T10:00:00.999Z"))).toEqual({
			type: "date-time",
			wall: { year: 2026, month: 9, day: 23, hour: 10, minute: 0, second: 0 },
			zone: "utc",
		});
	});

	test("toInstant resolves UTC and IANA TZIDs", () => {
		expect(toInstant(utc(Date.UTC(2026, 8, 23, 10)))).toBe(Date.UTC(2026, 8, 23, 10));
		let wall = { year: 2026, month: 7, day: 1, hour: 9, minute: 0, second: 0 };
		expect(toInstant({ type: "date-time", wall, zone: { tzid: "America/New_York" } })).toBe(
			Date.UTC(2026, 6, 1, 13),
		);
	});

	test("toInstant gives null for a DATE, a floating time and an unknown TZID", () => {
		let wall = { year: 2026, month: 7, day: 1, hour: 9, minute: 0, second: 0 };
		expect(toInstant({ type: "date", year: 2026, month: 7, day: 1 })).toBeNull();
		expect(toInstant({ type: "date-time", wall, zone: "floating" })).toBeNull();
		expect(
			toInstant({ type: "date-time", wall, zone: { tzid: "Pacific Standard Time" } }),
		).toBeNull();
	});
});

describe("calendarResponse", () => {
	test("serves the calendar as text/calendar", async () => {
		let response = calendarResponse(calendar({ events: [MAINTENANCE] }));
		expect(response.headers.get("Content-Type")).toBe(`${MEDIA_TYPE}; charset=utf-8`);
		expect(response.headers.get("Content-Disposition")).toBeNull();
		expect(unwrap(parse(await response.text())).calendar.events[0]?.uid).toBe("42@uptime");
	});

	test("adds the iTIP method and makes a download of a named file", () => {
		let response = calendarResponse(calendar({ method: "REQUEST" }), {
			filename: "maintenance.ics",
			status: 201,
		});
		expect(response.status).toBe(201);
		expect(response.headers.get("Content-Type")).toBe(
			"text/calendar; charset=utf-8; method=REQUEST",
		);
		expect(response.headers.get("Content-Disposition")).toBe(
			'attachment; filename="maintenance.ics"',
		);
	});

	test("encodes a file name outside ASCII and keeps the caller's headers", () => {
		let response = calendarResponse(calendar(), {
			filename: "mantenimiento-señal.ics",
			headers: { "Cache-Control": "max-age=3600", "Content-Type": "text/plain" },
		});
		expect(response.headers.get("Content-Disposition")).toBe(
			"attachment; filename=\"mantenimiento-se_al.ics\"; filename*=UTF-8''mantenimiento-se%C3%B1al.ics",
		);
		expect(response.headers.get("Cache-Control")).toBe("max-age=3600");
		expect(response.headers.get("Content-Type")).toBe("text/plain");
	});
});

describe("escapeText", () => {
	test("is exported for callers building untyped TEXT properties", () => {
		expect(escapeText("a,b")).toBe("a\\,b");
	});
});
