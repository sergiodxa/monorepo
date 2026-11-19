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

import type { CalendarEvent } from "./data";

import { PEOPLE, findPerson, seedEvents } from "./data";
import { freeSlots, workingSpans } from "./find";
import { eventsOf, readVisitor } from "./state";
import { clockAt, hourLabels, instancesIn, segmentsOf } from "./time";

/** A weekly 3 PM London meeting that began in the summer. */
const LONDON_SYNC: CalendarEvent = {
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
function newYorkStarts(event: CalendarEvent, first: string, days: number): Record<string, number> {
	return Object.fromEntries(
		instancesIn([event], first, days, "America/New_York").map((instance) => {
			let at = clockAt(instance.start.getTime(), "America/New_York");
			return [at.date, at.minute];
		}),
	);
}

/** Posts a form to a Sundial action path with the given cookie. */
async function post(page: string, fields: Record<string, string>, cookie = "") {
	return await fetchApp(`/demo/apps/sundial/${page}`, {
		method: "POST",
		body: new URLSearchParams(fields),
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
		let flight: CalendarEvent = {
			...LONDON_SYNC,
			id: "f",
			zone: "America/New_York",
			repeat: "none",
			date: "2026-11-24",
			start: 21 * 60 + 40,
			length: 420,
		};
		let [instance] = instancesIn([flight], "2026-11-24", 2, "America/New_York");
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
	test("moving one standup leaves the series in place and adds a one-off at the new time", async () => {
		let today = clockAt(Date.now(), "America/New_York").date;
		let standup = instancesIn(seedEvents(today), today, 7, "America/New_York").find(
			(instance) => instance.event.id === "standup",
		)!;
		let response = await post("move", {
			id: standup.key,
			date: standup.day,
			start: "840",
			end: "855",
			back: "day?d=2026-11-18",
		});
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toMatch(
			/^\/demo\/apps\/sundial\/day\?d=2026-11-18&toast=moved\./,
		);
		let visitor = readVisitor(cookiesOf(response));
		let events = eventsOf(visitor, today);
		let series = events.find((event) => event.id === "standup")!;
		expect(series.exceptions).toEqual([standup.day]);
		expect(series.start).toBe(570);
		let copy = events.find((event) => event.id === `standup-${standup.day.replaceAll("-", "")}`)!;
		expect([copy.date, copy.start, copy.length, copy.repeat]).toEqual([
			standup.day,
			840,
			15,
			"none",
		]);
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
		expect(readVisitor(cookie).changes.added.map((event) => event.title)).toEqual(["Pairing"]);
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
