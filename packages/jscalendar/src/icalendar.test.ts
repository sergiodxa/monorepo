/**
 * Tests for the conversion between JSCalendar and `@sdxc/icalendar`: every RFC 8984 example
 * round-trips through iCalendar text with the same occurrences, and the figures of
 * draft-ietf-calext-jscalendar-icalendar convert as the draft shows them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ICalendar } from "@sdxc/icalendar";

import { parse as parseICalendar, stringify as stringifyICalendar } from "@sdxc/icalendar";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { JSCalendar } from "./types.js";

import {
	EXAMPLES,
	OVERRIDES_EVENT,
	PARTICIPANTS_EVENT,
	SIMPLE_EVENT,
	SIMPLE_GROUP,
	TASK_WITH_DUE_DATE,
} from "./fixtures/rfc8984.js";
import { fromICalendar, toICalendar } from "./icalendar.js";
import { occurrences } from "./recurrence.js";

import { parse } from "./index.js";

/** Reads fixture text as a plain object to spread changes over. */
function json(text: string): Record<string, unknown> {
	return JSON.parse(text) as Record<string, unknown>;
}

/** The `DTSTAMP` of objects without `updated`, fixed so the text is stable. */
const NOW = new Date(Date.UTC(2020, 0, 1));

/** Converts an object to iCalendar text. */
function toText(object: JSCalendar.CalendarObject): string {
	return stringifyICalendar(unwrap(toICalendar(object, { now: NOW })));
}

/** Reads iCalendar text back into a Group. */
function fromText(text: string): JSCalendar.Group {
	return fromICalendar(unwrap(parseICalendar(text)).calendar);
}

/** The unfolded content lines of iCalendar text. */
function lines(text: string): string[] {
	return text.replaceAll("\r\n ", "").split("\r\n");
}

/** Wraps components in a minimal `VCALENDAR`. */
function calendar(...body: string[]): string {
	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//test//EN",
		...body,
		"END:VCALENDAR",
		"",
	].join("\r\n");
}

/** Wraps properties in a `VEVENT` with the UID and DTSTAMP every event needs. */
function vevent(...body: string[]): string {
	return ["BEGIN:VEVENT", "UID:test", "DTSTAMP:20240101T000000Z", ...body, "END:VEVENT"].join(
		"\r\n",
	);
}

/** The first entry of a converted calendar, as an event. */
function firstEvent(text: string): JSCalendar.Event {
	let entry = fromText(text).entries[0];
	if (entry?.["@type"] !== "Event") throw new Error("expected an event");
	return entry;
}

/** The occurrences of 2020 as comparable values. */
function schedule(object: JSCalendar.Entry) {
	let found = unwrap(
		occurrences(object, { from: Date.UTC(2020, 0, 1), to: Date.UTC(2021, 0, 1), limit: 400 }),
	);
	return found.map(({ recurrenceId, start, end, object: instance }) => ({
		recurrenceId,
		start,
		end,
		title: instance.title,
	}));
}

describe("RFC 8984 examples through iCalendar", () => {
	test.each(Object.entries(EXAMPLES))("§%s keeps its entries and occurrences", (_, text) => {
		let original = unwrap(parse(text));
		let back = fromText(toText(original));
		let entries = original["@type"] === "Group" ? original.entries : [original];
		expect(back.entries).toHaveLength(entries.length);
		entries.forEach((entry, index) => {
			let converted = back.entries[index] as JSCalendar.Entry;
			expect(converted["@type"]).toBe(entry["@type"]);
			expect(converted.uid).toBe(entry.uid);
			expect(converted.title).toBe(entry.title);
			expect(converted.updated).toBe(entry.updated);
			expect(converted.timeZone).toBe(entry.timeZone);
			expect(converted.recurrenceRules).toEqual(entry.recurrenceRules);
			expect(schedule(converted)).toEqual(schedule(entry));
		});
	});

	test("writes the simple event as a zoned VEVENT with its VTIMEZONE (§6.1)", () => {
		let text = toText(unwrap(parse(SIMPLE_EVENT)));
		let written = lines(text);
		expect(written).toContain("UID:a8df6573-0474-496d-8496-033ad45d7fea");
		expect(written).toContain("DTSTAMP:20200102T182304Z");
		expect(written).toContain("DTSTART;TZID=America/New_York:20200115T130000");
		expect(written).toContain("DURATION:PT1H");
		expect(written).toContain("SUMMARY:Some event");
		expect(written).toContain("TZID:America/New_York");
	});

	test("brings the simple group back as it was (§6.3)", () => {
		let back = fromText(toText(unwrap(parse(SIMPLE_GROUP))));
		expect(back).toEqual({
			...json(SIMPLE_GROUP),
			prodId: "-//sdxc//jscalendar//EN",
		});
	});

	test("writes overrides as RDATE, EXDATE and override components (§6.9)", () => {
		let written = lines(toText(unwrap(parse(OVERRIDES_EVENT))));
		expect(written).toContain("RRULE:FREQ=WEEKLY;UNTIL=20200624T080000Z");
		expect(written).toContain("RDATE;TZID=Europe/London:20200107T140000,20200625T090000");
		expect(written).toContain("EXDATE;TZID=Europe/London:20200401T090000");
		expect(written).toContain("RECURRENCE-ID;TZID=Europe/London:20200625T090000");
		expect(written).toContain("DTSTART;TZID=Europe/London:20200625T100000");
		expect(written).toContain("SUMMARY:Calculus I Exam");
	});

	test("folds an override back into the patch RFC 8984 writes (§6.10)", () => {
		let back = fromText(toText(unwrap(parse(PARTICIPANTS_EVENT))));
		let meeting = back.entries[0] as JSCalendar.Event;
		expect(meeting.recurrenceOverrides).toEqual({
			"2020-03-04T09:00:00": {
				"participants/dG9tQGZvb2Jhci5xlLmNvbQ/participationStatus": "declined",
			},
		});
		expect(meeting.participants?.dG9tQGZvb2Jhci5xlLmNvbQ).toEqual({
			"@type": "Participant",
			name: "Tom Tool",
			email: "tom@foobar.example.com",
			sendTo: { imip: "mailto:tom@calendar.example.com" },
			participationStatus: "accepted",
			roles: { attendee: true },
		});
		expect(meeting.replyTo).toEqual({
			imip: "mailto:f245f875-7f63-4a5e-a2c8@schedule.example.com",
		});
	});

	test("writes participants as ORGANIZER and ATTENDEEs (§6.10)", () => {
		let written = lines(toText(unwrap(parse(PARTICIPANTS_EVENT))));
		expect(written).toContain("ORGANIZER:mailto:f245f875-7f63-4a5e-a2c8@schedule.example.com");
		expect(written).toContainEqual(
			expect.stringMatching(/^ATTENDEE;CN=Zoe Zelda;ROLE=CHAIR;PARTSTAT=ACCEPTED/),
		);
		expect(written).toContain(
			"CONFERENCE;VALUE=URI;LABEL=ChatMe meeting room:https://chatme.example.com?id=1234567&pw=a8a24627b63d",
		);
	});

	test("writes a task as a VTODO and reads it back (§6.5)", () => {
		let task = unwrap(parse(TASK_WITH_DUE_DATE));
		let text = toText(task);
		expect(lines(text)).toContain("DUE;TZID=Europe/Vienna:20200119T180000");
		expect(lines(text)).toContain("ESTIMATED-DURATION:PT1H");
		expect(fromText(text).entries[0]).toEqual(task);
	});
});

describe("draft-ietf-calext-jscalendar-icalendar figures", () => {
	test("keys participants by the UUIDv5 of their address (figure 19)", () => {
		let event = firstEvent(
			calendar(
				vevent(
					"DTSTART:20240101T100000Z",
					"ATTENDEE;RSVP=TRUE;PARTSTAT=TENTATIVE;CN=Henry Cabot:mailto:hcabot@example.com",
					"ORGANIZER:mailto:organizer@example.com",
				),
			),
		);
		expect(event.participants).toEqual({
			"0b235cc4-f04d-5fc4-98a3-c066650b3fbf": {
				"@type": "Participant",
				sendTo: { imip: "mailto:hcabot@example.com" },
				name: "Henry Cabot",
				participationStatus: "tentative",
				expectReply: true,
				roles: { attendee: true },
			},
			"251d3e9f-d83f-534c-8c45-c2896c75670c": {
				"@type": "Participant",
				sendTo: { imip: "mailto:organizer@example.com" },
				roles: { owner: true },
			},
		});
		expect(event.replyTo).toEqual({ imip: "mailto:organizer@example.com" });
	});

	test("converts DTEND in another zone into a duration and an end zone (figure 33)", () => {
		let text = calendar(
			vevent(
				"DTSTART;TZID=Europe/Berlin:20241017T130000",
				"DTEND;TZID=Asia/Bangkok:20241018T040000",
			),
		);
		let event = firstEvent(text);
		expect(event).toMatchObject({
			start: "2024-10-17T13:00:00",
			timeZone: "Europe/Berlin",
			duration: "PT10H",
			locations: { end: { relativeTo: "end", timeZone: "Asia/Bangkok" } },
		});
		expect(lines(toText(event))).toContain("DTEND;TZID=Asia/Bangkok:20241018T040000");
	});

	test("remembers that a duration came from DTEND (figure 34)", () => {
		let event = firstEvent(
			calendar(
				vevent(
					"DTSTART;TZID=Australia/Melbourne:20241002T130000",
					"DTEND;TZID=Australia/Melbourne:20241002T140000",
				),
			),
		);
		expect(event.duration).toBe("PT1H");
		expect(event.iCalendar?.convertedProperties).toEqual({
			duration: { "@type": "ICalProperty", name: "dtend" },
		});
		expect(lines(toText(event))).toContain("DTEND;TZID=Australia/Melbourne:20241002T140000");
	});

	test("converts an all-day DTEND into whole days (figure 35)", () => {
		let event = firstEvent(
			calendar(vevent("DTSTART;VALUE=DATE:20240102", "DTEND;VALUE=DATE:20240107")),
		);
		expect(event).toMatchObject({
			start: "2024-01-02T00:00:00",
			duration: "P5D",
			showWithoutTime: true,
		});
		expect(event.timeZone).toBeUndefined();
		expect(lines(toText(event))).toContain("DTEND;VALUE=DATE:20240107");
	});

	test.each([
		["DTSTART;TZID=Europe/Berlin:20240921T105302", "Europe/Berlin"],
		["DTSTART:20240921T105302Z", "Etc/UTC"],
		["DTSTART:20240921T105302", undefined],
	])("reads %s into a start and zone (figures 37 to 39)", (line, zone) => {
		let event = firstEvent(calendar(vevent(line)));
		expect(event.start).toBe("2024-09-21T10:53:02");
		expect(event.timeZone).toBe(zone);
		expect(lines(toText(event))).toContain(line);
	});

	test("converts EXDATE into an excluded override (figure 48)", () => {
		let event = firstEvent(
			calendar(vevent("DTSTART:20230101T130000Z", "RRULE:FREQ=MONTHLY", "EXDATE:20230801T130000Z")),
		);
		expect(event.recurrenceRules).toEqual([{ "@type": "RecurrenceRule", frequency: "monthly" }]);
		expect(event.recurrenceOverrides).toEqual({ "2023-08-01T13:00:00": { excluded: true } });
	});

	test("converts an RDATE period into an override with its duration (figure 69)", () => {
		let text = calendar(
			vevent(
				"DTSTART:20230101T130000Z",
				"DURATION:PT1H",
				"RRULE:FREQ=MONTHLY",
				"RDATE;VALUE=PERIOD:20231223T150000Z/PT2H",
			),
		);
		let event = firstEvent(text);
		expect(event.recurrenceOverrides).toEqual({ "2023-12-23T15:00:00": { duration: "PT2H" } });
		expect(
			event.iCalendar?.convertedProperties?.["recurrenceOverrides/2023-12-23T15:00:00"],
		).toEqual({
			"@type": "ICalProperty",
			name: "rdate",
			valueType: "period",
		});
		expect(lines(toText(event))).toContain("RDATE;VALUE=PERIOD:20231223T150000Z/PT2H");
	});

	test("reads UNTIL as a LocalDateTime in the event's zone (figure 72)", () => {
		let event = firstEvent(
			calendar(
				vevent(
					"DTSTART;TZID=Europe/Berlin:20240101T010000",
					"RRULE:FREQ=YEARLY;INTERVAL=2;BYMONTH=1;BYDAY=SU;BYHOUR=8,9;BYMINUTE=30;UNTIL=20240930T120000Z",
				),
			),
		);
		expect(event.recurrenceRules).toEqual([
			{
				"@type": "RecurrenceRule",
				frequency: "yearly",
				interval: 2,
				byMonth: ["1"],
				byDay: [{ "@type": "NDay", day: "su" }],
				byHour: [8, 9],
				byMinute: [30],
				until: "2024-09-30T14:00:00",
			},
		]);
	});

	test("folds a recurrence override into its main event (figure 7)", () => {
		let event = firstEvent(
			calendar(
				vevent("RRULE:FREQ=DAILY", "DTSTART;TZID=Europe/Berlin:20240101T140000"),
				vevent(
					"RECURRENCE-ID;TZID=Europe/Berlin:20240202T140000",
					"DTSTART;TZID=Europe/Berlin:20240202T160000",
				),
			),
		);
		expect(event.recurrenceOverrides).toEqual({
			"2024-02-02T14:00:00": { start: "2024-02-02T16:00:00" },
		});
	});

	test("keeps an override without its main event as its own instance (figure 8)", () => {
		let group = fromText(
			calendar(
				vevent(
					"RECURRENCE-ID;TZID=Europe/Berlin:20240202T140000",
					"DTSTART;TZID=Europe/Berlin:20240202T160000",
				),
			),
		);
		expect(group.entries[0]).toMatchObject({
			recurrenceId: "2024-02-02T14:00:00",
			recurrenceIdTimeZone: "Europe/Berlin",
			start: "2024-02-02T16:00:00",
		});
	});

	test("converts triggers and keys an alarm by its UID (figures 10, 83 and 84)", () => {
		let event = firstEvent(
			calendar(
				vevent(
					"DTSTART:20240101T100000Z",
					"BEGIN:VALARM",
					"UID:04DC2968-6468-4B92-BC09-5A17D7D3D4E",
					"TRIGGER:-PT30M",
					"ACTION:DISPLAY",
					"DESCRIPTION:Breakfast meeting",
					"END:VALARM",
					"BEGIN:VALARM",
					"TRIGGER;RELATED=END:PT5M",
					"ACTION:AUDIO",
					"END:VALARM",
					"BEGIN:VALARM",
					"TRIGGER;VALUE=DATE-TIME:20250302T010203Z",
					"ACTION:DISPLAY",
					"DESCRIPTION:Later",
					"END:VALARM",
				),
			),
		);
		expect(event.alerts?.["04DC2968-6468-4B92-BC09-5A17D7D3D4E"]).toEqual({
			"@type": "Alert",
			trigger: { "@type": "OffsetTrigger", offset: "-PT30M" },
			action: "display",
			iCalendar: {
				"@type": "ICalComponent",
				name: "valarm",
				properties: [["description", {}, "text", "Breakfast meeting"]],
			},
		});
		expect(event.alerts?.["2"]).toMatchObject({
			trigger: { "@type": "OffsetTrigger", offset: "PT5M", relativeTo: "end" },
			iCalendar: { properties: [["action", {}, "text", "AUDIO"]] },
		});
		expect(event.alerts?.["3"]?.trigger).toEqual({
			"@type": "AbsoluteTrigger",
			when: "2025-03-02T01:02:03Z",
		});
		let written = lines(toText(event));
		expect(written).toContain("TRIGGER:-PT30M");
		expect(written).toContain("TRIGGER;RELATED=END:PT5M");
		expect(written).toContain("ACTION:AUDIO");
		expect(written).toContain("TRIGGER;VALUE=DATE-TIME:20250302T010203Z");
	});

	test("keys a URL and a LOCATION by the UUIDv5 of their value (figures 55 and 86)", () => {
		let event = firstEvent(
			calendar(
				vevent(
					"DTSTART:20240101T100000Z",
					"URL:https://example.com/myurl",
					"LOCATION:Conference Room - F123\\, Bldg. 002",
				),
			),
		);
		expect(event.links).toEqual({
			"6669391a-2c73-5b89-9cfe-7a6c95a855e3": {
				"@type": "Link",
				href: "https://example.com/myurl",
				rel: "describedby",
			},
		});
		expect(event.locations).toEqual({
			"adde7a5b-2fb5-52aa-b760-595ea9edb80a": {
				"@type": "Location",
				name: "Conference Room - F123, Bldg. 002",
			},
		});
	});

	test("keeps properties without a JSCalendar counterpart (figure 93)", () => {
		let text = calendar(vevent("DTSTART:20240101T100000Z", "X-BAR:bam"));
		let event = firstEvent(text);
		expect(event.iCalendar?.properties).toEqual([["x-bar", {}, "unknown", "bam"]]);
		expect(lines(toText(event))).toContain("X-BAR:bam");
	});
});

describe("calendar properties", () => {
	test("keeps the name, URL and refresh interval of a feed", () => {
		let feed: ICalendar.Calendar = {
			productId: "-//example//status//EN",
			name: "Maintenance",
			url: "https://status.example.com/status/acme",
			refreshInterval: { hours: 1 },
			timeZones: [],
			events: [],
			components: [],
			properties: [],
		};
		let group = fromICalendar(feed);
		expect(group).toMatchObject({
			title: "Maintenance",
			prodId: "-//example//status//EN",
			links: {
				[Object.keys(group.links ?? {})[0] as string]: { href: feed.url, rel: "describedby" },
			},
		});
		let back = unwrap(toICalendar(group));
		expect(back).toMatchObject({
			name: "Maintenance",
			url: feed.url,
			refreshInterval: { hours: 1 },
			productId: feed.productId,
		});
	});

	test("derives a stable group uid from the URL", () => {
		let feed: ICalendar.Calendar = {
			productId: "-//example//EN",
			url: "https://example.com/feed.ics",
			timeZones: [],
			events: [],
			components: [],
			properties: [],
		};
		expect(fromICalendar(feed).uid).toBe(fromICalendar(feed).uid);
		expect(fromICalendar(feed, { uid: "mine" }).uid).toBe("mine");
	});

	test("fails for a rule iCalendar cannot express", () => {
		let event: JSCalendar.Event = {
			"@type": "Event",
			uid: "x",
			start: "2020-01-01T00:00:00",
			recurrenceRules: [{ frequency: "yearly", rscale: "hebrew" }],
		};
		expect(isFailure(toICalendar(event))).toBe(true);
	});
});
