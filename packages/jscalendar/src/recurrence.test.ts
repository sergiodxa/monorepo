/**
 * Tests for recurrence expansion over the RFC 8984 examples: floating and zoned rules, an
 * all-day yearly rule, overrides that add, exclude and patch instances, excluded rules, and
 * PatchObject semantics on their own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { JSCalendar } from "./types.js";

import {
	ALL_DAY_EVENT,
	FLOATING_EVENT,
	OVERRIDES_EVENT,
	PARTICIPANTS_EVENT,
	SIMPLE_EVENT,
	TASK_WITH_DUE_DATE,
} from "./fixtures/rfc8984.js";
import { occurrences } from "./recurrence.js";

import { applyPatch, parse } from "./index.js";

/** Parses a fixture that holds an event. */
function event(text: string): JSCalendar.Event {
	let object = unwrap(parse(text));
	if (object["@type"] !== "Event") throw new Error("expected an event");
	return object;
}

/** The whole of 2020 as epoch milliseconds. */
const YEAR_2020 = { from: Date.UTC(2020, 0, 1), to: Date.UTC(2021, 0, 1) };

describe("occurrences", () => {
	test("returns an object without recurrence once, as itself", () => {
		let simple = event(SIMPLE_EVENT);
		let found = unwrap(occurrences(simple, YEAR_2020));
		expect(found).toEqual([
			{ start: Date.UTC(2020, 0, 15, 18), end: Date.UTC(2020, 0, 15, 19), object: simple },
		]);
	});

	test("reads a floating event in the zone the caller names (§6.7)", () => {
		let yoga = event(FLOATING_EVENT);
		let found = unwrap(
			occurrences(yoga, {
				from: Date.UTC(2020, 0, 1),
				to: Date.UTC(2020, 0, 4),
				timeZone: "America/New_York",
			}),
		);
		expect(found.map((occurrence) => occurrence.recurrenceId)).toEqual([
			"2020-01-01T07:00:00",
			"2020-01-02T07:00:00",
			"2020-01-03T07:00:00",
		]);
		expect(found[0]?.start).toBe(Date.UTC(2020, 0, 1, 12));
		expect(found[0]?.end).toBe(Date.UTC(2020, 0, 1, 12, 30));
		expect(found[1]?.object.start).toBe("2020-01-02T07:00:00");
		expect(found[1]?.object.recurrenceRules).toBeUndefined();
	});

	test("expands an all-day yearly rule from 1900 into 2020 (§6.4)", () => {
		let found = unwrap(occurrences(event(ALL_DAY_EVENT), YEAR_2020));
		expect(found).toHaveLength(1);
		expect(found[0]).toMatchObject({
			recurrenceId: "2020-04-01T00:00:00",
			start: Date.UTC(2020, 3, 1),
			end: Date.UTC(2020, 3, 2),
		});
	});

	test("adds, excludes and patches instances through overrides (§6.9)", () => {
		let found = unwrap(occurrences(event(OVERRIDES_EVENT), YEAR_2020));
		let ids = found.map((occurrence) => occurrence.recurrenceId);
		expect(found).toHaveLength(26);
		expect(ids[0]).toBe("2020-01-07T14:00:00");
		expect(found[0]?.object.title).toBe("Introduction to Calculus I (optional)");
		expect(ids).not.toContain("2020-04-01T09:00:00");
		expect(ids.at(-2)).toBe("2020-06-24T09:00:00");

		let exam = found.at(-1);
		expect(exam?.recurrenceId).toBe("2020-06-25T09:00:00");
		expect(exam?.object.title).toBe("Calculus I Exam");
		expect(exam?.start).toBe(Date.UTC(2020, 5, 25, 9));
		expect(exam?.end).toBe(Date.UTC(2020, 5, 25, 11));
		expect(Object.keys(exam?.object.locations ?? {})).toEqual(["auditorium"]);
	});

	test("keeps the wall-clock time across a DST change", () => {
		let found = unwrap(occurrences(event(OVERRIDES_EVENT), YEAR_2020));
		let winter = found.find((occurrence) => occurrence.recurrenceId === "2020-03-25T09:00:00");
		let summer = found.find((occurrence) => occurrence.recurrenceId === "2020-04-08T09:00:00");
		expect(winter?.start).toBe(Date.UTC(2020, 2, 25, 9));
		expect(summer?.start).toBe(Date.UTC(2020, 3, 8, 8));
	});

	test("patches a participant of one instance (§6.10)", () => {
		let meeting = event(PARTICIPANTS_EVENT);
		let found = unwrap(
			occurrences(meeting, { from: Date.UTC(2020, 1, 26), to: Date.UTC(2020, 2, 12) }),
		);
		let statuses = found.map(
			(occurrence) => occurrence.object.participants?.dG9tQGZvb2Jhci5xlLmNvbQ?.participationStatus,
		);
		expect(found.map((occurrence) => occurrence.recurrenceId)).toEqual([
			"2020-02-26T09:00:00",
			"2020-03-04T09:00:00",
			"2020-03-11T09:00:00",
		]);
		expect(statuses).toEqual(["accepted", "declined", "accepted"]);
		expect(found[1]?.object.recurrenceIdTimeZone).toBe("Africa/Johannesburg");
	});

	test("includes an occurrence still running when the window opens", () => {
		let found = unwrap(
			occurrences(event(ALL_DAY_EVENT), {
				from: Date.UTC(2020, 3, 1, 12),
				to: Date.UTC(2020, 3, 1, 13),
			}),
		);
		expect(found.map((occurrence) => occurrence.recurrenceId)).toEqual(["2020-04-01T00:00:00"]);
	});

	test("expands a task from its due date", () => {
		let task = unwrap(parse(TASK_WITH_DUE_DATE)) as JSCalendar.Task;
		let weekly: JSCalendar.Task = { ...task, recurrenceRules: [{ frequency: "weekly", count: 3 }] };
		let found = unwrap(occurrences(weekly, YEAR_2020));
		expect(found.map((occurrence) => occurrence.object.due)).toEqual([
			"2020-01-19T18:00:00",
			"2020-01-26T18:00:00",
			"2020-02-02T18:00:00",
		]);
		expect(found[0]?.start).toBe(Date.UTC(2020, 0, 19, 17));
	});

	test("removes what an excluded rule generates", () => {
		let weekdays: JSCalendar.Event = {
			"@type": "Event",
			uid: "weekdays",
			start: "2020-01-06T09:00:00",
			timeZone: "Etc/UTC",
			recurrenceRules: [{ frequency: "daily", count: 14 }],
			excludedRecurrenceRules: [{ frequency: "weekly", byDay: [{ day: "sa" }, { day: "su" }] }],
		};
		let found = unwrap(occurrences(weekdays, YEAR_2020));
		expect(found.map((occurrence) => occurrence.recurrenceId?.slice(0, 10))).toEqual([
			"2020-01-06",
			"2020-01-07",
			"2020-01-08",
			"2020-01-09",
			"2020-01-10",
			"2020-01-13",
			"2020-01-14",
			"2020-01-15",
			"2020-01-16",
			"2020-01-17",
		]);
	});

	test("keeps the start when an excluded rule does not select it", () => {
		let monthly: JSCalendar.Event = {
			"@type": "Event",
			uid: "monthly",
			start: "2020-01-01T09:00:00",
			recurrenceRules: [{ frequency: "daily", count: 20 }],
			excludedRecurrenceRules: [{ frequency: "monthly", byMonthDay: [15] }],
		};
		let ids = unwrap(occurrences(monthly, YEAR_2020)).map((occurrence) => occurrence.recurrenceId);
		expect(ids).toContain("2020-01-01T09:00:00");
		expect(ids).not.toContain("2020-01-15T09:00:00");
		expect(ids).toHaveLength(19);
	});

	test("unions several rules, counting a shared date once", () => {
		let twice: JSCalendar.Event = {
			"@type": "Event",
			uid: "twice",
			start: "2020-01-01T09:00:00",
			recurrenceRules: [
				{ frequency: "daily", interval: 2, count: 3 },
				{ frequency: "daily", interval: 3, count: 3 },
			],
		};
		let ids = unwrap(occurrences(twice, YEAR_2020)).map((occurrence) => occurrence.recurrenceId);
		expect(ids).toEqual([
			"2020-01-01T09:00:00",
			"2020-01-03T09:00:00",
			"2020-01-04T09:00:00",
			"2020-01-05T09:00:00",
			"2020-01-07T09:00:00",
		]);
	});

	test("stops at the limit", () => {
		let found = unwrap(occurrences(event(FLOATING_EVENT), { ...YEAR_2020, limit: 5 }));
		expect(found).toHaveLength(5);
	});

	test("fails for a calendar system other than Gregorian", () => {
		let hebrew: JSCalendar.Event = {
			...event(FLOATING_EVENT),
			recurrenceRules: [{ frequency: "yearly", rscale: "hebrew" }],
		};
		expect(isFailure(occurrences(hebrew, YEAR_2020))).toBe(true);
	});

	test("fails for a zone Intl does not know", () => {
		let lost = { ...event(FLOATING_EVENT), timeZone: "Mars/Olympus_Mons" };
		expect(isFailure(occurrences(lost, YEAR_2020))).toBe(true);
	});
});

describe("applyPatch", () => {
	let base = event(OVERRIDES_EVENT);

	test("sets, replaces and removes properties", () => {
		let patched = unwrap(
			applyPatch(base, { title: "Exam", "locations/mlab/description": null, duration: "PT2H" }),
		);
		expect(patched.title).toBe("Exam");
		expect(patched.duration).toBe("PT2H");
		expect(patched.locations?.mlab).toEqual({ "@type": "Location", title: "Math lab room 1" });
		expect(base.title).toBe("Calculus I");
	});

	test("replaces an existing array member", () => {
		let patched = unwrap(applyPatch(base, { "recurrenceRules/0/frequency": "daily" }));
		expect(patched.recurrenceRules?.[0]?.frequency).toBe("daily");
	});

	test.each([
		["a missing parent", { "participants/nobody/name": "x" }],
		["overlapping pointers", { locations: {}, "locations/mlab": null }],
		["a new array member", { "recurrenceRules/1": { frequency: "daily" } }],
		["a removed array member", { "recurrenceRules/0": null }],
	])("rejects %s and changes nothing", (_, patch) => {
		let result = applyPatch(base, patch);
		expect(isFailure(result)).toBe(true);
		expect(base.locations?.mlab?.description).toBe("Math Lab I, Department of Mathematics");
	});
});
