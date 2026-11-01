/**
 * Tests for the `sdxc-semver` command line: output, `--json` shapes and exit codes of `valid`,
 * `compare` and `sort`, with versions passed as arguments or piped on stdin, and the usage
 * errors input that is not a version produces — driven through `invoke()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "./cli.js";

describe("valid", () => {
	test("prints a version without its v or build metadata", async () => {
		let run = await invoke(cli, ["valid", "v1.2.3-rc.1+build.5"]);
		expect(run).toMatchObject({ code: 0, stdout: "1.2.3-rc.1\n", stderr: "" });
	});

	test("prints the parsed parts as JSON", async () => {
		let run = await invoke(cli, ["valid", "2.0.0-beta.11", "--json"]);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			valid: true,
			input: "2.0.0-beta.11",
			version: "2.0.0-beta.11",
			major: 2,
			minor: 0,
			patch: 0,
			prerelease: ["beta", "11"],
		});
	});

	test("exits 1 naming an invalid version on stderr", async () => {
		let run = await invoke(cli, ["valid", "01.2.3"]);
		expect(run.code).toBe(1);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain('Invalid version: "01.2.3"');
	});

	test("exits 1 with the reason as JSON", async () => {
		let run = await invoke(cli, ["valid", "1.2", "--json"]);
		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toEqual({
			valid: false,
			input: "1.2",
			error: 'Invalid version: "1.2"',
		});
	});

	test("exits 2 without a version", async () => {
		expect((await invoke(cli, ["valid"], { interactive: false })).code).toBe(2);
	});
});

describe("compare", () => {
	test.each([
		["1.0.0-rc.1", "1.0.0", "-1"],
		["2026.10.1", "2026.9.4", "1"],
		["v1.0.0", "1.0.0+build.7", "0"],
		["1.0.0-beta.2", "1.0.0-beta.11", "-1"],
	])("orders %s against %s as %s and exits 0", async (a, b, order) => {
		let run = await invoke(cli, ["compare", a, b]);
		expect(run).toMatchObject({ code: 0, stdout: `${order}\n`, stderr: "" });
	});

	test("exits 2 naming a side that is not a version", async () => {
		let run = await invoke(cli, ["compare", "1.0.0", "latest"]);
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain('Invalid version: "latest"');
	});
});

describe("sort", () => {
	test("sorts arguments by precedence", async () => {
		let run = await invoke(cli, [
			"sort",
			"1.0.0",
			"1.0.0-rc.1",
			"1.0.0-beta.11",
			"1.10.0",
			"1.0.0-beta.2",
			"1.9.0",
		]);
		expect(run).toMatchObject({
			code: 0,
			stdout: "1.0.0-beta.2\n1.0.0-beta.11\n1.0.0-rc.1\n1.0.0\n1.9.0\n1.10.0\n",
			stderr: "",
		});
	});

	test("reads stdin one per line, trimming and skipping blank lines", async () => {
		let run = await invoke(cli, ["sort"], { stdin: "v2026.10.1\r\n\n  2026.9.4\n2026.9.30\n" });
		expect(run).toMatchObject({ code: 0, stdout: "2026.9.4\n2026.9.30\nv2026.10.1\n" });
	});

	test("prints the newest first with --reverse, keeping equal versions in input order", async () => {
		let run = await invoke(cli, ["sort", "--reverse", "1.0.0", "2.0.0", "1.0.0+b", "0.9.0"]);
		expect(run.stdout).toBe("2.0.0\n1.0.0\n1.0.0+b\n0.9.0\n");
	});

	test("prints a JSON array", async () => {
		let run = await invoke(cli, ["sort", "--json", "1.1.0", "1.0.0"]);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual(["1.0.0", "1.1.0"]);
	});

	test("prints nothing for empty stdin", async () => {
		expect(await invoke(cli, ["sort"], { stdin: "" })).toMatchObject({ code: 0, stdout: "" });
	});

	test("exits 2 naming every entry that is not a version", async () => {
		let run = await invoke(cli, ["sort"], { stdin: "1.0.0\nlatest\n1.2\n" });
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain('Invalid version: "latest"');
		expect(run.stderr).toContain('Invalid version: "1.2"');
	});

	test("exits 2 at a terminal with no versions", async () => {
		let run = await invoke(cli, ["sort"]);
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
	});
});
