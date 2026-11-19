/**
 * Holds Sundial's server side to what a visitor relies on: a repeat keeps its own zone's wall
 * clock across both sides' DST changes, an overnight event splits at midnight, a dragged repeat
 * moves alone, a refused edit keeps what was typed, and every post returns only to Sundial.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

import type { Seed } from "./data";

import { PEOPLE, findPerson, mondayOf } from "./data";
import { freeSlots, workingSpans } from "./find";
import { toEntry } from "./model";
import { eventsOf, readVisitor, seedEntries } from "./state";
import { clockAt, hourLabels, instancesIn, segmentsOf } from "./time";

/** A weekly 3 PM London meeting that began in the summer. */
const LONDON_SYNC: Seed = {
	id: "sync",
	calendar: "work",
	title: "Sync",
	date: "2026-09-01",
	start: 900,
	length: 45,
	zone: "Europe/London",
	repeat: "weekly",
	guests: ["noor"],
};

/** The New York minute each of a series' occurrences starts at, by its day. */
function newYorkStarts(seed: Seed, first: string, days: number): Record<string, number> {
	return Object.fromEntries(
		instancesIn([toEntry(seed)], first, days, "America/New_York").map((instance) => {
			let at = clockAt(instance.start.getTime(), "America/New_York");
			return [at.date, at.minute];
		}),
	);
}

/** Posts a form to a Sundial action path with the given cookie; an array repeats its field. */
async function post(page: string, fields: Record<string, string | string[]>, cookie = "") {
	let body = new URLSearchParams();
	for (let [name, value] of Object.entries(fields)) {
		for (let item of Array.isArray(value) ? value : [value]) body.append(name, item);
	}
	return await fetchApp(`/demo/apps/sundial/${page}`, {
		method: "POST",
		body,
		headers: cookie === "" ? {} : { Cookie: cookie },
		redirect: "manual",
	});
}

/** Every `name=value` pair a response sets, joined as a `Cookie` header. */
function cookiesOf(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0] ?? "")
		.filter((pair) => !pair.endsWith("="))
		.join("; ");
}

describe("Sundial's clock", () => {
	test("keeps a London repeat at 3 PM London, which moves on a New York clock around DST", () => {
		let starts = newYorkStarts(LONDON_SYNC, "2026-10-19", 21);
		expect(starts["2026-10-20"]).toBe(600);
		expect(starts["2026-10-27"]).toBe(660);
		expect(starts["2026-11-03"]).toBe(600);
	});

	test("reads a second zone's hour labels for the day they sit beside", () => {
		let ordinary = hourLabels("2026-11-18", "America/New_York", "Europe/London");
		let between = hourLabels("2026-10-28", "America/New_York", "Europe/London");
		expect(ordinary[9]).toBe("2 PM");
		expect(between[9]).toBe("1 PM");
	});

	test("splits an overnight flight at midnight on the viewer's clock", () => {
		let flight: Seed = {
			...LONDON_SYNC,
			id: "f",
			zone: "America/New_York",
			repeat: "none",
			date: "2026-11-24",
			start: 21 * 60 + 40,
			length: 420,
		};
		let [instance] = instancesIn([toEntry(flight)], "2026-11-24", 2, "America/New_York");
		let pieces = segmentsOf(instance!, "America/New_York");
		expect(pieces.map((piece) => [piece.date, piece.start, piece.end])).toEqual([
			["2026-11-24", 1300, 1440],
			["2026-11-25", 0, 280],
		]);
	});

	test("reads a London teammate's working day an hour earlier in the weeks only London has changed", () => {
		let mara = findPerson("mara")!;
		expect(workingSpans(mara, "2026-11-18", "America/New_York")).toEqual([
			{ start: 240, end: 750 },
		]);
		expect(workingSpans(mara, "2026-10-28", "America/New_York")).toEqual([
			{ start: 300, end: 810 },
		]);
	});

	test("offers only the times everyone is working and free for the whole length", () => {
		let slots = freeSlots(
			[
				{ working: [{ start: 540, end: 1080 }], busy: [{ start: 600, end: 660 }] },
				{ working: [{ start: 480, end: 720 }], busy: [] },
			],
			45,
		);
		expect(slots).toEqual([
			{ start: 540, end: 600 },
			{ start: 660, end: 720 },
		]);
	});
});

describe("Sundial's posts", () => {
	test("moving one standup writes that occurrence's override and leaves the series in place", async () => {
		let today = clockAt(Date.now(), "America/New_York").date;
		let standup = instancesIn(seedEntries(today), today, 7, "America/New_York").find(
			(instance) => instance.uid === "standup",
		)!;
		let day = standup.recurrenceId!.slice(0, 10);
		let response = await post("move", {
			id: standup.key,
			date: day,
			start: "840",
			end: "855",
			back: "day?d=2026-11-18",
		});
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toMatch(
			/^\/demo\/apps\/sundial\/day\?d=2026-11-18&toast=moved\./,
		);
		let visitor = readVisitor(cookiesOf(response));
		expect(visitor.changes.patched.standup).toEqual({
			recurrenceOverrides: {
				[standup.recurrenceId!]: { start: `${day}T14:00:00`, duration: "PT15M" },
			},
		});
		let week = instancesIn(eventsOf(visitor, today), today, 7, "America/New_York").filter(
			(instance) => instance.uid === "standup",
		);
		let moved = week.find((instance) => instance.recurrenceId === standup.recurrenceId)!;
		expect(clockAt(moved.start.getTime(), "America/New_York")).toEqual({ date: day, minute: 840 });
		expect(
			week
				.filter((instance) => instance !== moved)
				.every((instance) => clockAt(instance.start.getTime(), "America/New_York").minute === 570),
		).toBe(true);
	});

	test("deleting one occurrence excludes it and keeps the rest of the series", async () => {
		let today = clockAt(Date.now(), "America/New_York").date;
		let standups = instancesIn(seedEntries(today), today, 7, "America/New_York").filter(
			(instance) => instance.uid === "standup",
		);
		let response = await post(`events/${encodeURIComponent(standups[0]!.key)}/delete`, {
			back: "",
		});
		let after = instancesIn(
			eventsOf(readVisitor(cookiesOf(response)), today),
			today,
			7,
			"America/New_York",
		);
		expect(after.filter((instance) => instance.uid === "standup")).toHaveLength(
			standups.length - 1,
		);
	});

	test("Undo puts the calendar back as it was before the last change", async () => {
		let created = await post("events/new", {
			title: "Pairing",
			date: "2026-11-19",
			start: "14:00",
			endDate: "2026-11-19",
			end: "15:00",
			zone: "America/New_York",
			repeat: "none",
			calendar: "work",
			guests: "noor",
			back: "",
		});
		let cookie = cookiesOf(created);
		expect(readVisitor(cookie).changes.added.map((entry) => entry.event.title)).toEqual([
			"Pairing",
		]);
		let undone = await post("undo", {}, cookie);
		expect(undone.headers.get("Location")).toMatch(/^\/demo\/apps\/sundial\?toast=undone\./);
		expect(readVisitor(cookiesOf(undone)).changes.added).toEqual([]);
	});

	test("refuses an event that ends before it starts, keeping every typed field", async () => {
		let response = await post("events/new", {
			title: "Backwards",
			date: "2026-11-19",
			start: "14:00",
			endDate: "2026-11-19",
			end: "13:00",
			zone: "America/New_York",
			repeat: "weekly",
			calendar: "personal",
			location: "Somewhere",
			back: "month?d=2026-11-19",
		});
		expect(response.status).toBe(400);
		let html = await response.text();
		expect(html).toContain("The event has to end after it starts.");
		expect(html).toContain('value="Backwards"');
		expect(html).toContain('value="Somewhere"');
	});

	test("returns only to Sundial's own screens", async () => {
		let response = await post("calendars", { show: "work", back: "https://example.com" });
		expect(response.headers.get("Location")).toMatch(/^\/demo\/apps\/sundial(\?|$)/);
		expect(readVisitor(cookiesOf(response)).hidden).toEqual([
			"team",
			"personal",
			"fitness",
			"travel",
			"holidays",
			"birthdays",
		]);
	});

	test("drops a tampered event from the cookie instead of drawing it", () => {
		let changes = encodeURIComponent(
			JSON.stringify({ added: [{ id: "x", title: 1 }], patched: {}, deleted: [] }),
		);
		expect(readVisitor(`sundial.changes=${changes}`).changes.added).toEqual([]);
	});
});

describe("Sundial's files and invitations", () => {
	test("serves a calendar as an iCalendar feed and as a JSCalendar Group", async () => {
		let ics = await fetchApp("/demo/apps/sundial/files/calendars/team.ics");
		expect(ics.headers.get("Content-Type")).toMatch(/^text\/calendar/);
		let text = await ics.text();
		expect(text).toContain("SUMMARY:Standup");
		expect(text).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/);
		let json = (await (await fetchApp("/demo/apps/sundial/files/calendars/team.json")).json()) as {
			"@type": string;
			entries: Array<{ uid: string }>;
		};
		expect(json["@type"]).toBe("Group");
		expect(json.entries.some((event) => event.uid === "standup")).toBe(true);
	});

	test("imports a JSCalendar Group into Travel and lands on its week", async () => {
		let group = {
			"@type": "Group",
			uid: "trip@wayfern.demo",
			entries: [
				{
					"@type": "Event",
					uid: "WF-1-flight-1@wayfern.demo",
					title: "Flight to Lisbon",
					start: "2026-12-03T21:40:00",
					timeZone: "America/New_York",
					duration: "PT7H",
				},
			],
		};
		let response = await post("import", { group: JSON.stringify(group), back: "" });
		expect(response.headers.get("Location")).toMatch(
			/^\/demo\/apps\/sundial\?d=2026-12-03&toast=imported\./,
		);
		let [added] = readVisitor(cookiesOf(response)).changes.added;
		expect([added?.calendar, added?.event.title]).toEqual(["travel", "Flight to Lisbon"]);
		let again = await post(
			"import",
			{ group: JSON.stringify(group), back: "" },
			cookiesOf(response),
		);
		expect(readVisitor(cookiesOf(again)).changes.added).toHaveLength(1);
	});

	test("reads an .ics upload, and sends a refused file back to the import page", async () => {
		let ics = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//Test//EN",
			"BEGIN:VEVENT",
			"UID:dinner@example.com",
			"DTSTAMP:20261101T000000Z",
			"DTSTART;TZID=Europe/Lisbon:20261205T200000",
			"DURATION:PT2H",
			"SUMMARY:Dinner at Taberna",
			"END:VEVENT",
			"END:VCALENDAR",
			"",
		].join("\r\n");
		let response = await post("import", { group: ics, back: "" });
		expect(readVisitor(cookiesOf(response)).changes.added[0]?.event.title).toBe(
			"Dinner at Taberna",
		);
		let refused = await post("import", { group: "not a calendar", back: "" });
		expect(refused.headers.get("Location")).toMatch(/\/sundial\/import\?d=[\d-]+&problem=1$/);
	});

	test("invites guests over iTIP and records each one's reply from their working day", async () => {
		let response = await post("events/new", {
			title: "Late review",
			date: "2026-11-19",
			start: "15:00",
			endDate: "2026-11-19",
			end: "15:30",
			zone: "America/New_York",
			repeat: "none",
			calendar: "work",
			guests: ["noor", "mara", "tomas"],
			back: "",
		});
		expect(response.headers.get("Location")).toMatch(/toast=invited\./);
		let [entry] = readVisitor(cookiesOf(response)).changes.added;
		let status = (id: string) => entry?.event.participants?.[id]?.participationStatus;
		expect(status("mara")).toBe("tentative");
		expect(status("tomas")).not.toBe("needs-action");
		expect(status("noor")).toBe("accepted");
	});

	test("writes the visitor's answer to an invitation as an iTIP REPLY", async () => {
		let today = clockAt(Date.now(), "America/New_York").date;
		let metrics = instancesIn(seedEntries(today), mondayOf(today), 7, "America/New_York").find(
			(instance) => instance.uid === "metrics",
		)!;
		let answered = await post(`events/${encodeURIComponent(metrics.key)}/rsvp`, {
			rsvp: "yes",
			back: "",
		});
		let reply = await fetchApp("/demo/apps/sundial/files/replies/metrics.ics", {
			headers: { Cookie: cookiesOf(answered) },
		});
		let text = (await reply.text()).replaceAll("\r\n ", "");
		expect(text).toContain("METHOD:REPLY");
		expect(text).toMatch(/PARTSTAT=ACCEPTED[^\r]*:mailto:noor@ridgeline\.studio/);
	});
});

describe("Sundial's screens", () => {
	test.each([
		"",
		"days",
		"day",
		"month",
		"agenda",
		"find",
		"?new=1",
		"?edit=review~2026-11-16&d=2026-11-18",
	])("renders %s with every teammate available to invite", async (page) => {
		let started = performance.now();
		let response = await fetchApp(
			`/demo/apps/sundial${page.startsWith("?") || page === "" ? "" : "/"}${page}`,
		);
		expect(response.status).toBe(200);
		let html = await response.text();
		expect(performance.now() - started).toBeLessThan(4000);
		if (page.includes("new") || page.includes("edit"))
			for (let person of PEOPLE) expect(html).toContain(person.name);
	});
});
