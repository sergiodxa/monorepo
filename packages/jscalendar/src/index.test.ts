/**
 * Tests for reading, validating and writing JSCalendar objects: every RFC 8984 §6 example
 * parses and serializes back unchanged, vendor properties survive, and the MUST rules of
 * the value formats and object constraints reject what they forbid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { EXAMPLES, OVERRIDES_EVENT, SIMPLE_EVENT, SIMPLE_GROUP } from "./fixtures/rfc8984.js";

import {
	contentType,
	formatDuration,
	formatLocalDateTime,
	formatUTCDateTime,
	jscalendarResponse,
	MEDIA_TYPE,
	parse,
	parseDuration,
	parseLocalDateTime,
	parseUTCDateTime,
	stringify,
} from "./index.js";

/** Reads fixture text as a plain object to spread changes over. */
function json(text: string): Record<string, unknown> {
	return JSON.parse(text) as Record<string, unknown>;
}

describe("parse", () => {
	test.each(Object.entries(EXAMPLES))("reads the RFC 8984 §%s example unchanged", (_, text) => {
		let parsed = parse(text);
		expect(isSuccess(parsed)).toBe(true);
		expect(JSON.parse(stringify(unwrap(parsed)))).toEqual(JSON.parse(text));
	});

	test("reads the simple event's typed properties", () => {
		let event = unwrap(parse(SIMPLE_EVENT));
		expect(event["@type"]).toBe("Event");
		if (event["@type"] !== "Event") return;
		expect(event.start).toBe("2020-01-15T13:00:00");
		expect(event.timeZone).toBe("America/New_York");
		expect(event.duration).toBe("PT1H");
	});

	test("reads a group's entries by their @type", () => {
		let group = unwrap(parse(SIMPLE_GROUP));
		if (group["@type"] !== "Group") throw new Error("expected a group");
		expect(group.entries.map((entry) => entry["@type"])).toEqual(["Event", "Task"]);
	});

	test("accepts already-parsed JSON", () => {
		expect(isSuccess(parse(JSON.parse(SIMPLE_EVENT)))).toBe(true);
	});

	test("keeps vendor-specific properties", () => {
		let text = JSON.stringify({
			...json(SIMPLE_EVENT),
			"example.com:color": "teal",
			locations: { a: { "@type": "Location", name: "Here", "example.com:floor": 3 } },
		});
		let event = unwrap(parse(text)) as unknown as Record<string, unknown>;
		expect(event["example.com:color"]).toBe("teal");
		expect(event.locations).toEqual({
			a: { "@type": "Location", name: "Here", "example.com:floor": 3 },
		});
	});

	test("accepts nested objects without @type, as jscalendarbis allows", () => {
		let event = { ...json(SIMPLE_EVENT), locations: { a: { name: "Here" } } };
		expect(isSuccess(parse(event))).toBe(true);
	});

	test("rejects text that is not JSON", () => {
		let parsed = parse("{");
		expect(isFailure(parsed) && parsed.error.message).toMatch(/not JSON/);
	});

	test("rejects an unknown @type", () => {
		expect(isFailure(parse({ "@type": "Journal", uid: "x" }))).toBe(true);
	});

	test.each([
		["an event without start", { start: undefined }],
		["a start with an offset", { start: "2020-01-15T13:00:00Z" }],
		["an impossible date", { start: "2020-02-30T13:00:00" }],
		["a fraction with a trailing zero", { start: "2020-01-15T13:00:00.500" }],
		["a signed duration", { duration: "-PT1H" }],
		["a duration skipping minutes", { duration: "PT1H5S" }],
		["a bare P", { duration: "P" }],
		["a non-Id map key", { locations: { "a b": { name: "x" } } }],
		["a wrong nested @type", { locations: { a: { "@type": "Link", href: "x" } } }],
		["a priority above 9", { priority: 10 }],
		[
			"recurrenceId beside recurrenceRules",
			{
				recurrenceId: "2020-01-15T13:00:00",
				recurrenceRules: [{ frequency: "daily" }],
			},
		],
		["recurrenceIdTimeZone without recurrenceId", { recurrenceIdTimeZone: "Europe/Berlin" }],
		[
			"a rule with count and until",
			{
				recurrenceRules: [{ frequency: "daily", count: 2, until: "2020-02-01T00:00:00" }],
			},
		],
		["an override key that is not a LocalDateTime", { recurrenceOverrides: { tomorrow: {} } }],
		[
			"an AbsoluteTrigger without when",
			{
				alerts: { a: { trigger: { "@type": "AbsoluteTrigger" } } },
			},
		],
	])("rejects %s", (_, change) => {
		let parsed = parse({ ...json(SIMPLE_EVENT), ...change });
		expect(isFailure(parsed)).toBe(true);
	});

	test("names the path of the first problem", () => {
		let parsed = parse({ ...json(SIMPLE_EVENT), duration: "1 hour" });
		if (!isFailure(parsed)) throw new Error("expected a failure");
		expect(parsed.error.issues[0]?.path).toEqual(["duration"]);
		expect(parsed.error.message).toMatch(/at duration/);
	});

	test("keeps a trigger of an unknown type", () => {
		let alerts = { a: { "@type": "Alert", trigger: { "@type": "LocationTrigger", radius: 5 } } };
		let event = unwrap(parse({ ...json(SIMPLE_EVENT), alerts }));
		if (event["@type"] !== "Event") throw new Error("expected an event");
		expect(event.alerts?.a?.trigger).toEqual({ "@type": "LocationTrigger", radius: 5 });
	});

	test("requires start or due on a task with rules", () => {
		let task = { "@type": "Task", uid: "t", recurrenceRules: [{ frequency: "daily" }] };
		expect(isFailure(parse(task))).toBe(true);
	});

	test("reads the recurrence of the overrides example", () => {
		let event = unwrap(parse(OVERRIDES_EVENT));
		if (event["@type"] !== "Event") throw new Error("expected an event");
		expect(event.recurrenceRules?.[0]?.until).toBe("2020-06-24T09:00:00");
		expect(event.recurrenceOverrides?.["2020-04-01T09:00:00"]).toEqual({ excluded: true });
	});
});

describe("values", () => {
	test("reads and writes durations in their single representation", () => {
		expect(parseDuration("P1W2DT3H4M5S")).toEqual({
			weeks: 1,
			days: 2,
			hours: 3,
			minutes: 4,
			seconds: 5,
		});
		expect(parseDuration("-PT15M")).toEqual({ negative: true, minutes: 15 });
		expect(parseDuration("PT0.5S")).toEqual({ seconds: 0.5 });
		expect(formatDuration({ hours: 1, seconds: 5 })).toBe("PT1H0M5S");
		expect(formatDuration({})).toBe("PT0S");
		expect(formatDuration({ negative: true, minutes: 15 })).toBe("-PT15M");
	});

	test("reads and writes date-times", () => {
		expect(parseLocalDateTime("2006-01-02T15:04:05.003")).toMatchObject({ millisecond: 3 });
		expect(
			formatLocalDateTime({
				year: 2006,
				month: 1,
				day: 2,
				hour: 15,
				minute: 4,
				second: 5,
				millisecond: 300,
			}),
		).toBe("2006-01-02T15:04:05.3");
		expect(parseUTCDateTime("2010-10-10T10:10:10.003Z")).toBe(Date.UTC(2010, 9, 10, 10, 10, 10, 3));
		expect(parseUTCDateTime("2010-10-10T10:10:10")).toBeNull();
		expect(formatUTCDateTime(Date.UTC(2010, 9, 10, 10, 10, 10))).toBe("2010-10-10T10:10:10Z");
	});
});

describe("responses", () => {
	test("serves an object with the media type and its type parameter", async () => {
		let group = unwrap(parse(SIMPLE_GROUP));
		let response = jscalendarResponse(group, { headers: { "Cache-Control": "no-store" } });
		expect(response.headers.get("Content-Type")).toBe(`${MEDIA_TYPE}; type=group`);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(await response.json()).toEqual(JSON.parse(SIMPLE_GROUP));
	});

	test("names each type", () => {
		expect(contentType(unwrap(parse(SIMPLE_EVENT)))).toBe(
			"application/jscalendar+json; type=event",
		);
	});
});
