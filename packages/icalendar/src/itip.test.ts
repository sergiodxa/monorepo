/**
 * Checks the iTIP helpers against the group-event examples RFC 5546 §4.2 prints: a request
 * built from the §4.2.1 event, the reply, update, cancel and attendee removal that follow it,
 * and the sequence rules of §2.1.4 that decide when a revision bumps `SEQUENCE`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	calendarPart,
	cancel,
	ITipError,
	nextSequence,
	readReply,
	reply,
	request,
} from "./itip.js";

import type { ICalendar } from "./index.js";

import { parse, stringify } from "./index.js";

/** The vendored RFC 5546 examples. */
const FIXTURES = new URL("./fixtures/rfc5546/", import.meta.url);

/** The product identifier every built message carries. */
const PRODUCT_ID = "-//Example/ExampleCalendarClient//EN";

/** The `DTSTAMP` the §4.2.9 and §4.2.10 messages were sent with. */
const SENT_AT = new Date("1997-06-13T19:00:00Z");

/**
 * A vendored example, parsed, failing the test on a warning.
 *
 * @param name - The file name
 * @returns The calendar
 */
function fixture(name: string): ICalendar.Calendar {
	let parsed = unwrap(parse(readFileSync(new URL(name, FIXTURES), "utf8")));
	expect(parsed.warnings).toEqual([]);
	return parsed.calendar;
}

/**
 * The one event of a calendar.
 *
 * @param calendar - The calendar
 * @returns Its first event
 */
function onlyEvent(calendar: ICalendar.Calendar): ICalendar.Event {
	let [event] = calendar.events;
	if (!event) throw new Error("The calendar has no typed VEVENT.");
	return event;
}

/**
 * The property values of a calendar's one `VEVENT` kept verbatim, which is how the reader
 * keeps a `CANCEL` or `REPLY` event that omits `DTSTART`.
 *
 * @param calendar - The calendar
 * @returns Each property name's values, in order
 */
function untypedEvent(calendar: ICalendar.Calendar): Record<string, string[]> {
	let [component] = calendar.components;
	if (component?.name !== "VEVENT") throw new Error("The calendar has no untyped VEVENT.");
	let values: Record<string, string[]> = {};
	for (let property of component.properties) (values[property.name] ??= []).push(property.value);
	return values;
}

/**
 * Writes a calendar and reads it back, so assertions see what a recipient would.
 *
 * @param calendar - The calendar to send
 * @returns The event the recipient reads
 */
function delivered(calendar: ICalendar.Calendar): ICalendar.Event {
	let parsed = unwrap(parse(stringify(calendar)));
	expect(parsed.warnings).toEqual([]);
	expect(parsed.calendar.method).toBe(calendar.method);
	return onlyEvent(parsed.calendar);
}

/**
 * Attendee addresses in order.
 *
 * @param event - The event
 * @returns Each attendee's address
 */
function addresses(event: ICalendar.Event): string[] {
	return (event.attendees ?? []).map((attendee) => attendee.address);
}

/** The §4.2.1 meeting as the organizer holds it. */
const MEETING = onlyEvent(fixture("section-4.2.1-request.ics"));

describe("request", () => {
	test("writes the §4.2.1 request with its attendees as the RFC prints them", () => {
		let calendar = unwrap(request(MEETING, { productId: PRODUCT_ID, dtstamp: MEETING.dtstamp }));
		let event = delivered(calendar);

		expect(calendar.method).toBe("REQUEST");
		expect(event).toEqual(MEETING);
	});

	test("asks every attendee without an answer to reply", () => {
		let calendar = unwrap(
			request(
				{
					...MEETING,
					attendees: [
						{ address: "mailto:b@example.com" },
						{ address: "mailto:e@example.com", role: "NON-PARTICIPANT" },
						{ address: "mailto:a@example.com", participation: "ACCEPTED" },
					],
				},
				{ productId: PRODUCT_ID },
			),
		);
		let [invited, observer, organizer] = delivered(calendar).attendees ?? [];

		expect(invited).toMatchObject({ participation: "NEEDS-ACTION", rsvp: true });
		expect(observer).toMatchObject({ participation: "NEEDS-ACTION", rsvp: false });
		expect(organizer?.participation).toBe("ACCEPTED");
		expect(organizer?.rsvp).toBeUndefined();
	});

	test("stamps the message with the moment it is built unless told otherwise", () => {
		let before = Date.now();
		let calendar = unwrap(request(MEETING, { productId: PRODUCT_ID }));

		expect(onlyEvent(calendar).dtstamp.getTime()).toBeGreaterThanOrEqual(before);
	});

	test("writes an empty SUMMARY for an event without one, since REQUEST requires it", () => {
		let { summary: _, ...untitled } = MEETING;
		let calendar = unwrap(request(untitled, { productId: PRODUCT_ID }));

		expect(stringify(calendar)).toContain("\r\nSUMMARY:\r\n");
	});

	test("carries the time zones the event's date-times name", () => {
		let zone: ICalendar.TimeZone = { tzid: "Europe/Madrid", observances: [] };
		let calendar = unwrap(request(MEETING, { productId: PRODUCT_ID, timeZones: [zone] }));

		expect(calendar.timeZones).toEqual([zone]);
	});

	test.each<[string, ICalendar.Event]>([
		["no organizer", { ...MEETING, organizer: undefined }],
		["no attendees", { ...MEETING, attendees: [] }],
		["no UID", { ...MEETING, uid: "" }],
		["a cancelled status", { ...MEETING, status: "CANCELLED" }],
	])("fails for an event with %s", (_, event) => {
		let result = request(event, { productId: PRODUCT_ID });

		expect(isFailure(result) && result.error).toBeInstanceOf(ITipError);
	});
});

describe("nextSequence", () => {
	/** The §4.2.3 update: the same meeting moved two hours earlier. */
	let update = onlyEvent(fixture("section-4.2.3-update.ics"));

	test("bumps the sequence when the event moves, as §4.2.3 does", () => {
		expect(nextSequence(MEETING, update)).toBe(1);
	});

	test.each<[string, Partial<ICalendar.Event>]>([
		["DTSTART", { start: update.start }],
		["DTEND", { end: update.end }],
		["DURATION", { end: undefined, duration: { hours: 1 } }],
		["RRULE", { recurrence: { frequency: "WEEKLY" } }],
		["RDATE", { recurrenceDates: [update.start] }],
		["EXDATE", { exceptionDates: [MEETING.start] }],
		["STATUS", { status: "TENTATIVE" }],
	])("bumps the sequence for a change to %s", (_, change) => {
		expect(nextSequence(MEETING, { ...MEETING, ...change })).toBe(1);
	});

	test("keeps the sequence for a change the attendees' answers survive", () => {
		let retitled = { ...MEETING, summary: "Phone Conference", description: "Agenda attached" };

		expect(nextSequence(MEETING, retitled)).toBe(0);
	});

	test("compares values, so an equal date written as a new object is no change", () => {
		let copy = structuredClone(MEETING);

		expect(nextSequence({ ...MEETING, sequence: 3 }, { ...copy, sequence: 3 })).toBe(3);
	});
});

describe("cancel", () => {
	/** The §4.2.9 cancellation of the whole meeting, which omits `DTSTART`. */
	let cancelled = untypedEvent(fixture("section-4.2.9-cancel.ics"));

	test("cancels the whole event as §4.2.9 does", () => {
		let calendar = unwrap(cancel(MEETING, { productId: PRODUCT_ID, dtstamp: SENT_AT }));
		let event = delivered(calendar);

		expect(calendar.method).toBe("CANCEL");
		expect([event.uid]).toEqual(cancelled.UID);
		expect([String(event.sequence)]).toEqual(cancelled.SEQUENCE);
		expect([event.status]).toEqual(cancelled.STATUS);
		expect(event.dtstamp).toEqual(SENT_AT);
		expect([event.organizer?.address]).toEqual(cancelled.ORGANIZER);
		expect(addresses(event).slice(0, 4)).toEqual(cancelled.ATTENDEE);
		expect(addresses(event)).toEqual(addresses(MEETING));
	});

	test("asks no attendee to reply to a cancellation", () => {
		let event = delivered(unwrap(cancel(MEETING, { productId: PRODUCT_ID })));

		for (let attendee of event.attendees ?? []) {
			expect(attendee.rsvp).toBeUndefined();
			expect(attendee.participation).toBeUndefined();
		}
		expect(event.alarms).toBeUndefined();
	});

	test("uninvites one attendee without a status, as §4.2.10 does", () => {
		let removal = untypedEvent(fixture("section-4.2.10-remove-attendee.ics"));
		let calendar = unwrap(
			cancel(MEETING, {
				productId: PRODUCT_ID,
				dtstamp: new Date("1997-06-13T19:30:00Z"),
				attendees: ["MAILTO:B@example.com"],
			}),
		);
		let event = delivered(calendar);

		expect(addresses(event)).toEqual(removal.ATTENDEE);
		expect(removal.STATUS).toBeUndefined();
		expect(event.status).toBeUndefined();
		expect([String(event.sequence)]).toEqual(removal.SEQUENCE);
		expect([event.uid]).toEqual(removal.UID);
	});

	test("bumps the sequence past the one the attendees hold", () => {
		let event = onlyEvent(unwrap(cancel({ ...MEETING, sequence: 4 }, { productId: PRODUCT_ID })));

		expect(event.sequence).toBe(5);
	});

	test.each<[string, ICalendar.Event, string[] | undefined]>([
		["no organizer", { ...MEETING, organizer: undefined }, undefined],
		["no attendees to notify", { ...MEETING, attendees: [] }, undefined],
		["an attendee the event does not have", MEETING, ["mailto:z@example.com"]],
	])("fails for %s", (_, event, attendees) => {
		let result = cancel(event, { productId: PRODUCT_ID, attendees });

		expect(isFailure(result) && result.error).toBeInstanceOf(ITipError);
	});
});

describe("reply", () => {
	/** The §4.2.2 acceptance. */
	let accepted = onlyEvent(
		unwrap(
			reply(MEETING, {
				productId: PRODUCT_ID,
				attendee: "mailto:b@example.com",
				participation: "ACCEPTED",
				dtstamp: new Date("1997-06-12T19:00:00Z"),
			}),
		),
	);

	test("answers for one attendee as §4.2.2 does", () => {
		let expected = unwrap(
			readReply(readFileSync(new URL("section-4.2.2-reply.ics", FIXTURES), "utf8")),
		);
		let [answer] = expected;

		expect(accepted.attendees).toHaveLength(1);
		expect(accepted.attendees?.[0]).toMatchObject(answer?.attendee ?? {});
		expect(accepted.attendees?.[0]?.rsvp).toBeUndefined();
		expect(accepted.organizer?.address).toBe(answer?.organizer?.address);
		expect(accepted.uid).toBe(answer?.uid);
		expect(accepted.sequence).toBe(answer?.sequence);
		expect(accepted.dtstamp).toEqual(answer?.dtstamp);
	});

	test("echoes the request's sequence instead of bumping it", () => {
		let update = onlyEvent(fixture("section-4.2.3-update.ics"));
		let event = onlyEvent(
			unwrap(
				reply(update, {
					productId: PRODUCT_ID,
					attendee: "mailto:c@example.com",
					participation: "DECLINED",
				}),
			),
		);

		expect(event.sequence).toBe(1);
		expect(event.attendees?.[0]?.participation).toBe("DECLINED");
	});

	test("carries a comment and the instance a reply is about", () => {
		let instance = { ...MEETING, recurrenceId: MEETING.start };
		let calendar = unwrap(
			reply(instance, {
				productId: PRODUCT_ID,
				attendee: "mailto:d@example.com",
				participation: "TENTATIVE",
				comment: "Running late, will join by 20:30",
			}),
		);
		let event = delivered(calendar);

		expect(calendar.method).toBe("REPLY");
		expect(event.recurrenceId).toEqual(MEETING.start);
		expect(event.properties).toContainEqual({
			name: "COMMENT",
			parameters: {},
			value: "Running late\\, will join by 20:30",
		});
	});

	test("answers for an uninvited attendee, which RFC 5546 lets an organizer accept", () => {
		let event = onlyEvent(
			unwrap(
				reply(MEETING, {
					productId: PRODUCT_ID,
					attendee: "mailto:z@example.com",
					participation: "ACCEPTED",
				}),
			),
		);

		expect(event.attendees).toEqual([
			{ address: "mailto:z@example.com", participation: "ACCEPTED" },
		]);
	});

	test("fails for an event without an organizer to answer", () => {
		let result = reply(
			{ ...MEETING, organizer: undefined },
			{ productId: PRODUCT_ID, attendee: "mailto:b@example.com", participation: "ACCEPTED" },
		);

		expect(isFailure(result) && result.error).toBeInstanceOf(ITipError);
	});
});

describe("readReply", () => {
	test("reads the §4.2.2 reply, which carries no DTSTART", () => {
		let text = readFileSync(new URL("section-4.2.2-reply.ics", FIXTURES), "utf8");

		expect(unwrap(readReply(text))).toEqual([
			{
				uid: "calsrv.example.com-873970198738777@example.com",
				sequence: 0,
				dtstamp: new Date("1997-06-12T19:00:00Z"),
				organizer: { address: "mailto:a@example.com" },
				attendee: { address: "mailto:b@example.com", participation: "ACCEPTED" },
			},
		]);
	});

	test("reads a reply built by reply()", () => {
		let calendar = unwrap(
			reply(MEETING, {
				productId: PRODUCT_ID,
				attendee: "mailto:d@example.com",
				participation: "DECLINED",
			}),
		);
		let [answer] = unwrap(readReply(stringify(calendar)));

		expect(answer?.attendee).toMatchObject({
			address: "mailto:d@example.com",
			name: "Hal",
			participation: "DECLINED",
		});
		expect(answer?.sequence).toBe(0);
	});

	test("reads a parsed calendar as well as text", () => {
		let calendar = unwrap(
			reply(
				{ ...MEETING, sequence: 2, recurrenceId: MEETING.start },
				{ productId: PRODUCT_ID, attendee: "mailto:b@example.com", participation: "TENTATIVE" },
			),
		);
		let [answer] = unwrap(readReply(calendar));

		expect(answer?.sequence).toBe(2);
		expect(answer?.recurrenceId).toEqual(MEETING.start);
	});

	test("counts a reply without SEQUENCE as answering revision 0", () => {
		let text = readFileSync(new URL("section-4.2.2-reply.ics", FIXTURES), "utf8");
		let [answer] = unwrap(readReply(text.replace("SEQUENCE:0\r\n", "")));

		expect(answer?.sequence).toBe(0);
	});

	test.each<[string, string]>([
		["a request", "section-4.2.1-request.ics"],
		["a cancellation", "section-4.2.9-cancel.ics"],
	])("fails for %s", (_, name) => {
		let result = readReply(readFileSync(new URL(name, FIXTURES), "utf8"));

		expect(isFailure(result) && result.error).toBeInstanceOf(ITipError);
	});

	test.each<[string, (text: string) => string]>([
		["no attendee", (text) => text.replace(/ATTENDEE.*\r\n/, "")],
		[
			"two attendees",
			(text) => text.replace("ORGANIZER", "ATTENDEE:mailto:c@example.com\r\nORGANIZER"),
		],
		["no UID", (text) => text.replace(/UID:.*\r\n/, "")],
		["no VEVENT", (text) => text.replace(/BEGIN:VEVENT[\s\S]*END:VEVENT\r\n/, "")],
		["a broken structure", (text) => text.replace("END:VEVENT\r\n", "")],
	])("fails for a reply with %s", (_, edit) => {
		let text = readFileSync(new URL("section-4.2.2-reply.ics", FIXTURES), "utf8");
		let result = readReply(edit(text));

		expect(isFailure(result) && result.error).toBeInstanceOf(ITipError);
	});
});

describe("calendarPart", () => {
	test("gives the mail part the calendar's method and text", () => {
		let calendar = unwrap(request(MEETING, { productId: PRODUCT_ID }));

		expect(calendarPart(calendar)).toEqual({ method: "REQUEST", content: stringify(calendar) });
	});

	test("adds the attachment name when asked", () => {
		let calendar = unwrap(cancel(MEETING, { productId: PRODUCT_ID }));

		expect(calendarPart(calendar, { filename: "cancel.ics" })).toMatchObject({
			method: "CANCEL",
			filename: "cancel.ics",
		});
	});

	test("labels a calendar without a method as PUBLISH", () => {
		let calendar = fixture("section-4.2.1-request.ics");

		expect(calendarPart({ ...calendar, method: undefined }).method).toBe("PUBLISH");
	});
});
