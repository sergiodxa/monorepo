/**
 * Tests for the `sdxc-jscalendar` command line through `invoke()`: what each command prints on
 * stdout and stderr and the exit code it answers, for documents read from a file and from
 * stdin, in both formats, valid and not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";
import { SIMPLE_EVENT, SIMPLE_GROUP } from "./fixtures/rfc8984.js";

/** A weekly 15-minute standup in Madrid, with the second week moved an hour later. */
const STANDUP = JSON.stringify({
	"@type": "Event",
	uid: "standup@example.com",
	title: "Standup",
	start: "2026-11-02T09:00:00",
	timeZone: "Europe/Madrid",
	duration: "PT15M",
	recurrenceRules: [{ "@type": "RecurrenceRule", frequency: "weekly" }],
	recurrenceOverrides: { "2026-11-09T09:00:00": { start: "2026-11-09T10:00:00" } },
});

/** A one-event iCalendar file, written with CRLF line endings as RFC 5545 requires. */
const ICS = [
	"BEGIN:VCALENDAR",
	"VERSION:2.0",
	"PRODID:-//Example//EN",
	"BEGIN:VEVENT",
	"UID:launch@example.com",
	"DTSTAMP:20261001T000000Z",
	"DTSTART:20261105T150000Z",
	"DURATION:PT1H",
	"SUMMARY:Launch",
	"END:VEVENT",
	"END:VCALENDAR",
	"",
].join("\r\n");

const CREATED_DIRS: string[] = [];

afterEach(async () => {
	for (let dir of CREATED_DIRS.splice(0)) await rm(dir, { recursive: true, force: true });
});

/** A fresh directory holding `files`, removed after the test. */
async function directoryWith(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "jscalendar-cli-"));
	CREATED_DIRS.push(root);
	for (let [name, text] of Object.entries(files)) await writeFile(join(root, name), text, "utf8");
	return root;
}

describe("sdxc-jscalendar convert", () => {
	test("writes a JSCalendar event read from a file as iCalendar", async () => {
		let cwd = await directoryWith({ "event.json": SIMPLE_EVENT });
		let run = await invoke(cli, ["convert", "event.json", "--to", "icalendar"], { cwd });

		expect(run.code).toBe(0);
		expect(run.stderr).toBe("");
		expect(run.stdout).toMatch(/^BEGIN:VCALENDAR\r\n/);
		expect(run.stdout).toContain("UID:a8df6573-0474-496d-8496-033ad45d7fea\r\n");
		expect(run.stdout).toContain("DTSTART;TZID=America/New_York:20200115T130000\r\n");
		expect(run.stdout).toContain("BEGIN:VTIMEZONE\r\n");
	});

	test("detects iCalendar on stdin and prints a JSCalendar Group", async () => {
		let run = await invoke(cli, ["convert", "--to", "jscalendar"], { stdin: ICS });

		expect(run.code).toBe(0);
		let group = JSON.parse(run.stdout) as { "@type": string; entries: unknown[] };
		expect(group["@type"]).toBe("Group");
		expect(group.entries).toMatchObject([
			{ "@type": "Event", uid: "launch@example.com", title: "Launch", duration: "PT1H" },
		]);
	});

	test("reads stdin when the file is -", async () => {
		let run = await invoke(cli, ["convert", "-", "--to", "icalendar"], { stdin: SIMPLE_EVENT });

		expect(run.code).toBe(0);
		expect(run.stdout).toContain("SUMMARY:Some event\r\n");
	});

	test("a --from that disagrees with the text reports it as unreadable", async () => {
		let run = await invoke(cli, ["convert", "--from", "icalendar", "--to", "jscalendar"], {
			stdin: SIMPLE_EVENT,
		});

		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("Invalid iCalendar");
	});

	test("asking for the input's own format is a usage error", async () => {
		let run = await invoke(cli, ["convert", "--to", "jscalendar"], { stdin: SIMPLE_EVENT });

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("The input is already jscalendar; nothing to convert");
	});

	test("an invalid JSCalendar document exits 2 with its first problem", async () => {
		let run = await invoke(cli, ["convert", "--to", "icalendar"], {
			stdin: JSON.stringify({ "@type": "Event", title: "No uid" }),
		});

		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("Invalid JSCalendar");
	});

	test("an unknown --to value is a usage error", async () => {
		let run = await invoke(cli, ["convert", "--to", "vcard"], { stdin: SIMPLE_EVENT });

		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
	});

	test("a missing file exits 2 naming it", async () => {
		let cwd = await directoryWith({});
		let run = await invoke(cli, ["convert", "missing.json", "--to", "icalendar"], { cwd });

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Cannot read missing.json");
	});

	test("no file and a terminal on stdin exits 2 instead of waiting", async () => {
		let run = await invoke(cli, ["convert", "--to", "icalendar"]);

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("No input");
	});
});

describe("sdxc-jscalendar expand", () => {
	test("lists each occurrence in the window, its override applied", async () => {
		let run = await invoke(cli, ["expand", "--from", "2026-11-01", "--until", "2026-11-17"], {
			stdin: STANDUP,
		});

		expect(run.code).toBe(0);
		expect(run.stderr).toBe("");
		expect(run.stdout).toBe(
			[
				"2026-11-02T08:00:00Z\t2026-11-02T08:15:00Z\tstandup@example.com\tStandup",
				"2026-11-09T09:00:00Z\t2026-11-09T09:15:00Z\tstandup@example.com\tStandup",
				"2026-11-16T08:00:00Z\t2026-11-16T08:15:00Z\tstandup@example.com\tStandup",
				"",
			].join("\n"),
		);
	});

	test("reads window dates without an offset in --time-zone", async () => {
		let run = await invoke(
			cli,
			[
				"expand",
				"--from",
				"2026-11-02T09:10:00",
				"--until",
				"2026-11-09T00:00:00Z",
				"--time-zone",
				"Europe/Madrid",
			],
			{ stdin: STANDUP },
		);

		expect(run.code).toBe(0);
		expect(run.stdout.trim().split("\n")).toHaveLength(1);
	});

	test("prints the occurrences as JSON with --json", async () => {
		let run = await invoke(
			cli,
			["expand", "--from", "2026-11-01", "--until", "2026-11-10", "--json", "--limit", "2"],
			{ stdin: STANDUP },
		);

		expect(run.code).toBe(0);
		let report = JSON.parse(run.stdout) as { occurrences: unknown[] };
		expect(report.occurrences).toHaveLength(2);
		expect(report.occurrences[1]).toMatchObject({
			uid: "standup@example.com",
			recurrenceId: "2026-11-09T09:00:00",
			start: "2026-11-09T09:00:00Z",
			end: "2026-11-09T09:15:00Z",
			object: { start: "2026-11-09T10:00:00", recurrenceId: "2026-11-09T09:00:00" },
		});
	});

	test("expands every entry of an iCalendar file", async () => {
		let cwd = await directoryWith({ "calendar.ics": ICS });
		let run = await invoke(
			cli,
			["expand", "calendar.ics", "--from", "2026-11-01", "--until", "2026-12-01"],
			{ cwd },
		);

		expect(run.code).toBe(0);
		expect(run.stdout).toBe(
			"2026-11-05T15:00:00Z\t2026-11-05T16:00:00Z\tlaunch@example.com\tLaunch\n",
		);
	});

	test("merges a Group's entries earliest first", async () => {
		let run = await invoke(cli, ["expand", "--from", "2020-01-01", "--until", "2020-02-01"], {
			stdin: SIMPLE_GROUP,
		});

		expect(run.code).toBe(0);
		expect(run.stdout).toBe(
			"2020-01-15T18:00:00Z\t2020-01-15T19:00:00Z\ta8df6573-0474-496d-8496-033ad45d7fea\tSome event\n",
		);
	});

	test("an empty window exits 0 and says so on stderr", async () => {
		let run = await invoke(cli, ["expand", "--from", "2020-01-01", "--until", "2020-01-02"], {
			stdin: STANDUP,
		});

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("No occurrences in the window");
	});

	test("a recurrence that cannot be expanded exits 1", async () => {
		let lunar = JSON.parse(STANDUP) as { recurrenceRules: { rscale?: string }[] };
		lunar.recurrenceRules = [{ ...lunar.recurrenceRules[0], rscale: "chinese" }];
		let run = await invoke(cli, ["expand", "--from", "2026-11-01", "--until", "2026-12-01"], {
			stdin: JSON.stringify(lunar),
		});

		expect(run.code).toBe(1);
		expect(run.stdout).toBe("");
		expect(run.stderr).not.toBe("");
	});

	test.each([
		[["--from", "next week", "--until", "2026-12-01"], "--from expects a date or date-time"],
		[["--from", "2026-12-01", "--until", "2026-11-01"], "--until has to be later than --from"],
		[
			["--from", "2026-11-01", "--until", "2026-12-01", "--time-zone", "Mars/Olympus"],
			"--time-zone Mars/Olympus is not an IANA zone",
		],
		[["--from", "2026-11-01", "--until", "2026-12-01", "--limit", "0"], "--limit expects"],
	])("rejects a bad window %j as a usage error", async (flags, message) => {
		let run = await invoke(cli, ["expand", ...flags], { stdin: STANDUP });

		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain(message);
	});
});

describe("sdxc-jscalendar validate", () => {
	test("a valid document exits 0 naming its type and uid", async () => {
		let run = await invoke(cli, ["validate"], { stdin: SIMPLE_EVENT });

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("Valid Event a8df6573-0474-496d-8496-033ad45d7fea\n");
		expect(run.stderr).toBe("");
	});

	test("an invalid document exits 1 with each problem at its path", async () => {
		let cwd = await directoryWith({
			"event.json": JSON.stringify({
				"@type": "Event",
				uid: "broken@example.com",
				start: "tomorrow",
				duration: "an hour",
			}),
		});
		let run = await invoke(cli, ["validate", "event.json"], { cwd });

		expect(run.code).toBe(1);
		let lines = run.stdout.trim().split("\n");
		expect(lines.length).toBeGreaterThanOrEqual(2);
		expect(lines.some((line) => line.startsWith("start: "))).toBe(true);
		expect(lines.some((line) => line.startsWith("duration: "))).toBe(true);
	});

	test("text that is not JSON is one problem at the root", async () => {
		let run = await invoke(cli, ["validate"], { stdin: ICS });

		expect(run.code).toBe(1);
		expect(run.stdout).toMatch(/^\(root\): The text is not JSON/);
	});

	test("prints the result as JSON with --json", async () => {
		let valid = await invoke(cli, ["validate", "--json"], { stdin: SIMPLE_GROUP });
		let invalid = await invoke(cli, ["validate", "--json"], {
			stdin: JSON.stringify({ "@type": "Task" }),
		});

		expect(valid.code).toBe(0);
		expect(JSON.parse(valid.stdout)).toEqual({
			valid: true,
			type: "Group",
			uid: "bf0ac22b-4989-4caf-9ebd-54301b4ee51a",
			issues: [],
		});
		expect(invalid.code).toBe(1);
		let report = JSON.parse(invalid.stdout) as { issues: unknown[] };
		expect(report).toMatchObject({ valid: false, type: null, uid: null });
		expect(report.issues[0]).toMatchObject({
			path: expect.any(Array),
			message: expect.any(String),
		});
	});
});

describe("sdxc-jscalendar --help", () => {
	test("lists every command", async () => {
		let run = await invoke(cli, ["--help"]);

		expect(run.code).toBe(0);
		for (let name of ["convert", "expand", "validate"]) expect(run.stdout).toContain(name);
	});
});
