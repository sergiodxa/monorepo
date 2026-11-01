/**
 * Tests for the `sdxc-icalendar` command line through `invoke()`: what each command prints on
 * stdout and stderr and the exit code it answers, for valid and broken calendars, zoned and
 * overridden recurrences, bare rules, `--json` reports, usage errors and unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

/**
 * A calendar of the given events, each a list of content lines between its BEGIN and END.
 *
 * @param events - The events' content lines
 */
function calendar(events: string[][]): string {
	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//test//EN",
		...events.flatMap((lines) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"]),
		"END:VCALENDAR",
		"",
	].join("\r\n");
}

const STANDUP = calendar([
	[
		"UID:standup@example.com",
		"DTSTAMP:20260101T000000Z",
		"DTSTART;TZID=Europe/Madrid:20261022T093000",
		"DURATION:PT15M",
		"RRULE:FREQ=DAILY;COUNT=5",
		"EXDATE;TZID=Europe/Madrid:20261024T093000",
		"SUMMARY:Standup",
	],
	[
		"UID:standup@example.com",
		"DTSTAMP:20260101T000000Z",
		"RECURRENCE-ID;TZID=Europe/Madrid:20261023T093000",
		"DTSTART;TZID=Europe/Madrid:20261023T110000",
		"DURATION:PT15M",
		"SUMMARY:Standup (moved)",
	],
]);

let directory = "";

beforeAll(async () => {
	directory = await mkdtemp(join(tmpdir(), "sdxc-icalendar-"));
	await writeFile(join(directory, "standup.ics"), STANDUP);
});

afterAll(async () => {
	await rm(directory, { recursive: true, force: true });
});

describe("validate", () => {
	test("a valid calendar exits 0 with a summary", async () => {
		let run = await invoke(cli, ["validate", "standup.ics"], { cwd: directory });
		expect(run).toMatchObject({ code: 0, stdout: "Valid: 1 calendar, 2 events\n", stderr: "" });
	});

	test("prints each problem with its line and exits 1", async () => {
		let source = calendar([
			["DTSTART:20261101T100000Z", "RRULE:FREQ=DAILY"],
			["UID:b", "DTSTAMP:20260101T000000Z", "DTSTART;TZID=Nowhere/Special:20261101T100000"],
		]);
		let run = await invoke(cli, ["validate"], { stdin: source });
		expect(run.code).toBe(1);
		expect(run.stdout).toBe(
			[
				"Line 4: VEVENT has no UID",
				"Line 4: VEVENT has no DTSTAMP",
				"VEVENT b: TZID Nowhere/Special resolves through neither the calendar nor Intl",
				"3 problems in 1 calendar, 2 events",
				"",
			].join("\n"),
		);
	});

	test("reports a structural error as a problem with its line", async () => {
		let run = await invoke(cli, ["validate", "-", "--json"], {
			stdin: "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nEND:VCALENDAR\r\n",
		});
		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toEqual({
			valid: false,
			calendars: 0,
			events: 0,
			problems: [{ line: 3, message: "END:VCALENDAR closes BEGIN:VEVENT from line 2" }],
		});
	});

	test("--json reports a valid calendar", async () => {
		let run = await invoke(cli, ["validate", "--json"], { stdin: STANDUP });
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			valid: true,
			calendars: 1,
			events: 2,
			problems: [],
		});
	});

	test("a missing file exits 2 on stderr", async () => {
		let run = await invoke(cli, ["validate", "missing.ics"], { cwd: directory });
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("Cannot read missing.ics");
	});
});

describe("expand", () => {
	test("lists occurrences with the override in place and the EXDATE removed", async () => {
		let run = await invoke(
			cli,
			[
				"expand",
				"standup.ics",
				"--from",
				"2026-10-01",
				"--until",
				"2026-11-01",
				"--time-zone",
				"Europe/Madrid",
			],
			{ cwd: directory },
		);
		expect(run.code).toBe(0);
		expect(run.stdout).toBe(
			[
				"2026-10-22T09:30:00+02:00\t2026-10-22T09:45:00+02:00\tStandup",
				"2026-10-23T11:00:00+02:00\t2026-10-23T11:15:00+02:00\tStandup (moved)",
				"2026-10-25T09:30:00+01:00\t2026-10-25T09:45:00+01:00\tStandup",
				"2026-10-26T09:30:00+01:00\t2026-10-26T09:45:00+01:00\tStandup",
				"",
			].join("\n"),
		);
	});

	test("--json prints UTC instants and honors --limit", async () => {
		let run = await invoke(
			cli,
			["expand", "--from", "2026-10-22T00:00Z", "--until", "2026-11-01", "--limit", "1", "--json"],
			{ stdin: STANDUP },
		);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			occurrences: [
				{
					uid: "standup@example.com",
					summary: "Standup",
					start: "2026-10-22T07:30:00Z",
					end: "2026-10-22T07:45:00Z",
				},
			],
		});
	});

	test("an empty window is a usage error", async () => {
		let run = await invoke(cli, ["expand", "--from", "2026-11-01", "--until", "2026-10-01"], {
			stdin: STANDUP,
		});
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("--until must be later than --from");
	});

	test("a malformed date is a usage error", async () => {
		let run = await invoke(cli, ["expand", "--from", "tomorrow", "--until", "2026-10-01"], {
			stdin: STANDUP,
		});
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("--from");
	});

	test("an event whose zone does not resolve exits 1", async () => {
		let source = calendar([
			["UID:a", "DTSTAMP:20260101T000000Z", "DTSTART;TZID=Nowhere/Special:20261101T100000"],
		]);
		let run = await invoke(cli, ["expand", "--from", "2026-10-01", "--until", "2026-12-01"], {
			stdin: source,
		});
		expect(run.code).toBe(1);
		expect(run.stderr).toContain("TZID Nowhere/Special");
	});

	test("text that is no calendar exits 2", async () => {
		let run = await invoke(cli, ["expand", "--from", "2026-10-01", "--until", "2026-12-01"], {
			stdin: "hello\n",
		});
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Not a readable calendar");
	});
});

describe("rrule", () => {
	test("prints occurrences on the zone's wall clock across a DST change", async () => {
		let run = await invoke(cli, [
			"rrule",
			"RRULE:FREQ=WEEKLY;BYDAY=MO,WE",
			"--start",
			"2026-10-19T09:30",
			"--time-zone",
			"Europe/Madrid",
			"-n",
			"4",
		]);
		expect(run).toMatchObject({
			code: 0,
			stdout: [
				"2026-10-19T09:30:00+02:00",
				"2026-10-21T09:30:00+02:00",
				"2026-10-26T09:30:00+01:00",
				"2026-10-28T09:30:00+01:00",
				"",
			].join("\n"),
			stderr: "",
		});
	});

	test("--json prints the normalized rule and all-day occurrences", async () => {
		let run = await invoke(cli, [
			"rrule",
			"freq=monthly;byday=-1fr;count=2",
			"--start",
			"2026-11-27",
			"--json",
		]);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			rule: "FREQ=MONTHLY;COUNT=2;BYDAY=-1FR",
			occurrences: ["2026-11-27T00:00:00Z", "2026-12-25T00:00:00Z"],
		});
	});

	test("reads a start with an offset as that instant", async () => {
		let run = await invoke(cli, [
			"rrule",
			"FREQ=DAILY",
			"--start",
			"2026-11-02T09:30+01:00",
			"-n",
			"1",
		]);
		expect(run.stdout).toBe("2026-11-02T08:30:00Z\n");
	});

	test("a rule that does not parse exits 1", async () => {
		let run = await invoke(cli, ["rrule", "FREQ=NOPE", "--start", "2026-11-27"]);
		expect(run.code).toBe(1);
		expect(run.stderr).toContain("FREQ=NOPE");
	});

	test("an unknown time zone is a usage error", async () => {
		let run = await invoke(cli, [
			"rrule",
			"FREQ=DAILY",
			"--start",
			"2026-11-27",
			"--time-zone",
			"Mars/Olympus",
		]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("IANA time zone");
	});
});
