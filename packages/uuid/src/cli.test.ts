/**
 * Tests for the `sdxc-uuid` command line: generated values, their count and order, and the
 * report, `--json` shape and exit code `validate` gives a valid, an invalid and a piped UUID —
 * driven through `invoke()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "./cli.js";

import { isUUID } from "./index.js";

/** A version 7 UUID generated at 2025-11-08T12:34:56.789Z. */
const V7 = "019a6376-6c95-7a4b-9d3e-8f1a2b3c4d5e";

/** A version 4 UUID. */
const V4 = "550e8400-e29b-41d4-a716-446655440000";

/** The lines a run printed, without the final newline. */
function lines(stdout: string) {
	return stdout.replace(/\n$/, "").split("\n");
}

describe("v4", () => {
	test("prints one version 4 UUID", async () => {
		let run = await invoke(cli, ["v4"]);
		expect(run.code).toBe(0);
		let [id] = lines(run.stdout);
		expect(lines(run.stdout)).toHaveLength(1);
		expect(isUUID(id!)).toBe(true);
		expect(id![14]).toBe("4");
	});

	test("prints -n distinct values", async () => {
		let run = await invoke(cli, ["v4", "-n", "5"]);
		expect(run.code).toBe(0);
		expect(new Set(lines(run.stdout)).size).toBe(5);
	});

	test("rejects a count that is not a positive integer", async () => {
		let run = await invoke(cli, ["v4", "-n", "0"]);
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
	});
});

describe("v7", () => {
	test("prints values in the order they sort", async () => {
		let run = await invoke(cli, ["v7", "--count", "50"]);
		expect(run.code).toBe(0);
		let ids = lines(run.stdout);
		expect(ids).toHaveLength(50);
		expect(ids.every((id) => isUUID(id) && id[14] === "7")).toBe(true);
		expect([...ids].sort()).toEqual(ids);
	});
});

describe("validate", () => {
	test("reports a v7 UUID's version and creation time", async () => {
		let run = await invoke(cli, ["validate", V7]);
		expect(run.code).toBe(0);
		expect(run.stdout).toBe("valid\nversion 7\ntimestamp 2025-11-08T12:34:56.789Z\n");
	});

	test("prints the report as JSON", async () => {
		let run = await invoke(cli, ["validate", V7, "--json"]);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			valid: true,
			uuid: V7,
			version: 7,
			timestamp: "2025-11-08T12:34:56.789Z",
		});
	});

	test("leaves the timestamp out for other versions", async () => {
		let run = await invoke(cli, ["validate", V4, "--json"]);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({ valid: true, uuid: V4, version: 4 });
	});

	test("exits 1 with the reason for an invalid value", async () => {
		let run = await invoke(cli, ["validate", "not-a-uuid"]);
		expect(run.code).toBe(1);
		expect(run.stdout).toBe("invalid: Invalid UUID length: 10\n");
	});

	test("exits 1 for uppercase hex, which has a second spelling", async () => {
		let run = await invoke(cli, ["validate", V4.toUpperCase(), "--json"]);
		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toEqual({
			valid: false,
			uuid: V4.toUpperCase(),
			error: `Invalid UUID format: ${V4.toUpperCase()}`,
		});
	});

	test("reads the UUID from stdin, dropping the line ending", async () => {
		let run = await invoke(cli, ["validate"], { stdin: `${V4}\n` });
		expect(run.code).toBe(0);
		expect(run.stdout).toBe("valid\nversion 4\n");
	});
});
