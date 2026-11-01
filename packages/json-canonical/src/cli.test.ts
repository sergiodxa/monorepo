/**
 * Tests for the `sdxc-json-canonical` command line: canonical bytes and digests from a file or
 * stdin, and the exit codes for unreadable input, text that is not JSON and JSON outside
 * I-JSON — driven through `invoke()` with both streams captured.
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

const CREATED_DIRS: string[] = [];

/** The SHA-256 of `{"a":1,"b":2}`, the canonical form of every document below. */
const SHA256_HEX = "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777";

afterEach(async () => {
	for (let dir of CREATED_DIRS.splice(0)) {
		await rm(dir, { recursive: true, force: true });
	}
});

/** A temporary directory holding `payload.json` with `text`, removed after the test. */
async function writePayload(text: string): Promise<string> {
	let dir = await mkdtemp(join(tmpdir(), "json-canonical-cli-"));
	CREATED_DIRS.push(dir);
	await writeFile(join(dir, "payload.json"), text, "utf8");
	return dir;
}

describe("sdxc-json-canonical canonicalize", () => {
	test("prints a file's canonical form with no trailing newline", async () => {
		let cwd = await writePayload('{\n  "b": 2,\n  "a": 1\n}\n');
		let run = await invoke(cli, ["canonicalize", "payload.json"], { cwd });
		expect(run).toMatchObject({ code: 0, stdout: '{"a":1,"b":2}', stderr: "" });
	});

	test("reads stdin when the file is absent or -, and --newline ends the line", async () => {
		let absent = await invoke(cli, ["canonicalize"], { stdin: '{"b":2,"a":1}' });
		let dash = await invoke(cli, ["canonicalize", "-", "--newline"], {
			stdin: '{"n": 1E30, "x": 0.000001}',
		});
		expect(absent).toMatchObject({ code: 0, stdout: '{"a":1,"b":2}' });
		expect(dash).toMatchObject({ code: 0, stdout: '{"n":1e+30,"x":0.000001}\n' });
	});

	test("a missing file exits 2 naming it", async () => {
		let cwd = await writePayload("{}");
		let run = await invoke(cli, ["canonicalize", "missing.json"], { cwd });
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("Cannot read missing.json");
	});

	test("text that is not JSON exits 2", async () => {
		let run = await invoke(cli, ["canonicalize"], { stdin: "{a:1}" });
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("<stdin> is not JSON");
	});

	test("JSON outside I-JSON exits 1 naming the offending pointer", async () => {
		let run = await invoke(cli, ["canonicalize"], { stdin: '{"list":[1,1e400]}' });
		expect(run.code).toBe(1);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("<stdin> at /list/1:");
	});
});

describe("sdxc-json-canonical hash", () => {
	test("prints the SHA-256 of the canonical bytes in hex by default", async () => {
		let cwd = await writePayload('{ "b": 2, "a": 1 }');
		let run = await invoke(cli, ["hash", "payload.json"], { cwd });
		expect(run).toMatchObject({ code: 0, stdout: `${SHA256_HEX}\n`, stderr: "" });
	});

	test("member order and whitespace leave the digest unchanged", async () => {
		let first = await invoke(cli, ["hash"], { stdin: '{"a":1,"b":2}' });
		let second = await invoke(cli, ["hash", "-"], { stdin: '{\n"b" : 2,\n"a" : 1}' });
		expect(first.stdout).toBe(second.stdout);
	});

	test("--base64url prints the digest unpadded in the URL-safe alphabet", async () => {
		let run = await invoke(cli, ["hash", "--base64url"], { stdin: '{"b":2,"a":1}' });
		expect(run).toMatchObject({
			code: 0,
			stdout: "QyWM_3g_5wNtikMDP4MK38YOwDc4JHNUisdCuIgpJ3c\n",
		});
	});

	test("--alg picks the digest", async () => {
		let run = await invoke(cli, ["hash", "--alg", "sha-512"], { stdin: '{"b":2,"a":1}' });
		expect(run.code).toBe(0);
		expect(run.stdout).toMatch(/^b5da773f945631ed9943[0-9a-f]{108}\n$/);
	});

	test("an unknown algorithm is a usage error", async () => {
		let run = await invoke(cli, ["hash", "--alg", "md5"], { stdin: "{}" });
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
	});

	test("JSON outside I-JSON exits 1 with nothing on stdout", async () => {
		let run = await invoke(cli, ["hash"], { stdin: '"\\ud800"' });
		expect(run.code).toBe(1);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("<stdin> at the root:");
	});
});
