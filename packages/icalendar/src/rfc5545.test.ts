/**
 * Reads every example object RFC 5545 prints, vendored under `fixtures/rfc5545`: each parses
 * without failures or warnings, types what the model names, keeps the rest verbatim, and
 * survives a stringify and parse round trip unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readdirSync, readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parse, stringify, unescapeText } from "./index.js";

/** The vendored examples. */
const FIXTURES = new URL("./fixtures/rfc5545/", import.meta.url);

/**
 * A vendored example's text.
 *
 * @param name - The file name
 * @returns Its contents
 */
function fixture(name: string): string {
	return readFileSync(new URL(name, FIXTURES), "utf8");
}

/**
 * A vendored example, parsed.
 *
 * @param name - The file name
 * @returns The parsed calendar and its warnings
 */
function parsed(name: string) {
	return unwrap(parse(fixture(name)));
}

/** Every vendored `.ics` file. */
const FILES = readdirSync(FIXTURES).filter((name) => name.endsWith(".ics"));

describe("every RFC 5545 example", () => {
	test("is vendored", () => {
		expect(FILES).toHaveLength(14);
	});

	test.each(FILES)("%s parses without warnings", (name) => {
		expect(parsed(name).warnings).toEqual([]);
	});

	test.each(FILES)("%s survives a round trip", (name) => {
		let { calendar } = parsed(name);
		let again = unwrap(parse(stringify(calendar)));
		expect(again.calendar).toEqual(calendar);
		expect(again.warnings).toEqual([]);
	});
});

describe("§3.4 simple object", () => {
	test("is written back byte for byte", () => {
		let text = fixture("section-3.4-simple.ics");
		expect(stringify(parsed("section-3.4-simple.ics").calendar)).toBe(text);
	});
});

describe("§3.6.1 events", () => {
	test("types the four events", () => {
		let [review, reminder, anniversary, festival] = parsed("section-3.6.1-events.ics").calendar
			.events;
		expect(review).toMatchObject({
			uid: "19970901T130000Z-123401@example.com",
			dtstamp: new Date(Date.UTC(1997, 8, 1, 13)),
			summary: "Annual Employee Review",
			categories: ["BUSINESS", "HUMAN RESOURCES"],
			properties: [{ name: "CLASS", parameters: {}, value: "PRIVATE" }],
		});
		expect(reminder?.transparency).toBe("TRANSPARENT");
		expect(anniversary).toMatchObject({
			start: { type: "date", year: 1997, month: 11, day: 2 },
			recurrence: { frequency: "YEARLY" },
			categories: ["ANNIVERSARY", "PERSONAL", "SPECIAL OCCASION"],
		});
		expect(festival?.end).toEqual({ type: "date", year: 2007, month: 7, day: 9 });
	});
});

describe("§3.6.5 time zones", () => {
	test("types every New York observance, rules and RDATE included", () => {
		let [zone] = parsed("section-3.6.5-new-york-full.ics").calendar.timeZones;
		expect(zone?.tzid).toBe("America/New_York");
		expect(zone?.properties).toEqual([
			{ name: "LAST-MODIFIED", parameters: {}, value: "20050809T050000Z" },
		]);
		expect(zone?.observances.map((observance) => observance.kind)).toEqual([
			"DAYLIGHT",
			"STANDARD",
			"DAYLIGHT",
			"DAYLIGHT",
			"DAYLIGHT",
			"DAYLIGHT",
			"STANDARD",
		]);
		expect(zone?.observances[0]).toEqual({
			kind: "DAYLIGHT",
			start: { year: 1967, month: 4, day: 30, hour: 2, minute: 0, second: 0 },
			recurrence: {
				frequency: "YEARLY",
				byMonth: [4],
				byDay: [{ weekday: "SU", ordinal: -1 }],
				until: {
					type: "date-time",
					wall: { year: 1973, month: 4, day: 29, hour: 7, minute: 0, second: 0 },
					zone: "utc",
				},
			},
			offsetFrom: -300,
			offsetTo: -240,
			name: "EDT",
		});
		expect(zone?.observances[2]?.recurrenceDates).toEqual([
			{ year: 1975, month: 2, day: 23, hour: 2, minute: 0, second: 0 },
		]);
	});

	test("keeps TZURL on the zone", () => {
		let [zone] = parsed("section-3.6.5-new-york-rrule.ics").calendar.timeZones;
		expect(zone?.properties?.map((property) => property.name)).toEqual(["LAST-MODIFIED", "TZURL"]);
	});
});

describe("§3.6.6 alarms", () => {
	test("types the audio, display and email alarms", () => {
		let [event] = parsed("section-3.6.6-alarms.ics").calendar.events;
		let [audio, display, email] = event?.alarms ?? [];
		expect(audio).toEqual({
			action: "AUDIO",
			trigger: { at: new Date(Date.UTC(1997, 2, 17, 13, 30)) },
			repeat: { count: 4, every: { minutes: 15 } },
			properties: [
				{
					name: "ATTACH",
					parameters: { FMTTYPE: ["audio/basic"] },
					value: "ftp://example.com/pub/sounds/bell-01.aud",
				},
			],
		});
		expect(display).toEqual({
			action: "DISPLAY",
			trigger: { before: { minutes: 30 } },
			repeat: { count: 2, every: { minutes: 15 } },
			description: "Breakfast meeting with executive\nteam at 8:30 AM EST.",
		});
		expect(email).toMatchObject({
			action: "EMAIL",
			trigger: { before: { days: 2 }, related: "END" },
			attendees: [{ address: "mailto:john_doe@example.com" }],
			summary: "*** REMINDER: SEND AGENDA FOR WEEKLY STAFF MEETING ***",
		});
		expect(email?.description).toContain("attendees to the weekly managers meeting (MGR-LIST).");
	});
});

describe("§4 object examples", () => {
	test("unfolds and unescapes the conference description", () => {
		let { calendar } = parsed("section-4-conference.ics");
		expect(calendar.productId).toBe("-//xyz Corp//NONSGML PDA Calendar Version 1.0//EN");
		expect(calendar.events[0]).toMatchObject({
			uid: "uid1@example.com",
			organizer: { address: "mailto:jsmith@example.com" },
			status: "CONFIRMED",
			start: { zone: "utc", wall: { year: 1996, month: 9, day: 18, hour: 14, minute: 30 } },
			description:
				"Networld+Interop Conference and Exhibit\nAtlanta World Congress Center\nAtlanta, Georgia",
		});
	});

	test("types the group meeting's attendee and keeps CUTYPE", () => {
		let { calendar } = parsed("section-4-group-meeting.ics");
		expect(calendar.timeZones[0]?.observances).toHaveLength(2);
		let [event] = calendar.events;
		expect(event?.attendees).toEqual([
			{
				address: "mailto:employee-A@example.com",
				rsvp: true,
				role: "REQ-PARTICIPANT",
				parameters: { CUTYPE: ["GROUP"] },
			},
		]);
		expect(event?.start).toEqual({
			type: "date-time",
			wall: { year: 1998, month: 3, day: 12, hour: 8, minute: 30, second: 0 },
			zone: { tzid: "America/New_York" },
		});
		expect(event?.created).toEqual(new Date(Date.UTC(1998, 2, 9, 13)));
	});

	test("keeps METHOD and an ATTACH folded mid-URL", () => {
		let { calendar } = parsed("section-4-mime.ics");
		expect(calendar.method).toBe("XYZ");
		let [event] = calendar.events;
		expect(event?.sequence).toBe(0);
		expect(event?.categories).toEqual(["MEETING", "PROJECT"]);
		expect(event?.properties).toContainEqual({
			name: "ATTACH",
			parameters: { FMTTYPE: ["application/postscript"] },
			value: "ftp://example.com/pub/conf/bkgrnd.ps",
		});
	});

	test("keeps a to-do and its alarm as an untyped component", () => {
		let { calendar } = parsed("section-4-todo.ics");
		expect(calendar.events).toEqual([]);
		let [todo] = calendar.components;
		expect(todo?.name).toBe("VTODO");
		expect(todo?.properties.find((property) => property.name === "DUE")?.value).toBe(
			"19980415T000000",
		);
		expect(todo?.components[0]?.name).toBe("VALARM");
	});

	test("keeps a journal entry with its escapes intact", () => {
		let [journal] = parsed("section-4-journal.ics").calendar.components;
		let description =
			journal?.properties.find((property) => property.name === "DESCRIPTION")?.value ?? "";
		expect(description).toContain("John Smith\\, Jane Doe\\, Jim Dandy");
		expect(unescapeText(description)).toContain("Participants: John Smith, Jane Doe, Jim Dandy\n");
	});

	test("keeps free/busy periods verbatim", () => {
		let [busy] = parsed("section-4-free-busy.ics").calendar.components;
		expect(busy?.properties.filter((property) => property.name === "FREEBUSY")).toHaveLength(3);
	});
});
