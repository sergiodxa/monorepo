/**
 * Tests for the `sdxc-cron` command line, run through `invoke()` so each asserts what a person
 * or script sees: stdout, stderr and the exit code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "./cli.js";

describe("next", () => {
	test("lists runs on the zone's wall clock across a daylight saving change", async () => {
		let run = await invoke(cli, [
			"next",
			"0 9 * * MON-FRI",
			"--tz",
			"America/New_York",
			"-n",
			"3",
			"--from",
			"2026-03-06T00:00:00Z",
		]);
		expect(run.code).toBe(0);
		expect(run.stdout).toBe(
			"2026-03-06T09:00:00-05:00[America/New_York]\n2026-03-09T09:00:00-04:00[America/New_York]\n2026-03-10T09:00:00-04:00[America/New_York]\n",
		);
	});

	test("prints instants and local times with --json", async () => {
		let run = await invoke(cli, [
			"next",
			"30 2 * * *",
			"--tz",
			"America/New_York",
			"-n",
			"1",
			"--from",
			"2026-03-07T12:00:00Z",
			"--json",
		]);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			expression: "30 2 * * *",
			timeZone: "America/New_York",
			from: "2026-03-07T12:00:00.000Z",
			occurrences: [
				{
					instant: "2026-03-08T07:30:00.000Z",
					local: "2026-03-08T03:30:00-04:00[America/New_York]",
				},
			],
		});
	});

	test("rejects an unknown zone and a zero count as usage errors", async () => {
		let zone = await invoke(cli, ["next", "* * * * *", "--tz", "Mars/Base"]);
		expect(zone.code).toBe(2);
		expect(zone.stderr).toContain('--tz: expects an IANA time zone; got "Mars/Base"');
		let count = await invoke(cli, ["next", "* * * * *", "-n", "0"]);
		expect(count.code).toBe(2);
	});

	test("exits 2 with a caret for an invalid expression", async () => {
		let run = await invoke(cli, ["next", "0 25 * * *", "--tz", "UTC"]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain(
			"Invalid cron expression: out-of-range in the hour field\n  0 25 * * *\n    ^\n",
		);
	});
});

describe("describe", () => {
	test("prints a sentence and the normalized expression", async () => {
		let run = await invoke(cli, ["describe", "0 9 * * mon-fri"]);
		expect(run.code).toBe(0);
		expect(run.stdout).toBe(
			"Every Monday, Tuesday, Wednesday, Thursday and Friday at 09:00\nExpression: 0 9 * * 1-5\n",
		);
	});

	test("prints the descriptor with --json", async () => {
		let run = await invoke(cli, ["describe", "*/15 * * * *", "--json"]);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			expression: "*/15 * * * *",
			normalized: "*/15 * * * *",
			summary: "Every 15 minutes",
			descriptor: { kind: "interval", unit: "minute", every: 15 },
		});
	});
});

describe("validate", () => {
	test("prints the normalized form of a valid expression read from stdin", async () => {
		let run = await invoke(cli, ["validate"], { stdin: "@weekly\n" });
		expect(run.code).toBe(0);
		expect(run.stdout).toBe("Valid: 0 0 * * 0\n");
	});

	test("exits 1 naming the field of an invalid expression", async () => {
		let run = await invoke(cli, ["validate", "0 25 * * *"]);
		expect(run.code).toBe(1);
		expect(run.stderr).toContain("out-of-range in the hour field");
		let json = await invoke(cli, ["validate", "0 25 * * *", "--json"]);
		expect(json.code).toBe(1);
		expect(JSON.parse(json.stdout)).toEqual({
			valid: false,
			expression: "0 25 * * *",
			reason: "out-of-range",
			field: "hour",
			position: 2,
		});
	});
});
