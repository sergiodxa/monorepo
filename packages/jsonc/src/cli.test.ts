/**
 * Tests for the `sdxc-jsonc` command line: checking and stripping a JSONC document from a file
 * or stdin, the `file:line:column` and `--json` reports, and the exit codes for parse errors and
 * unreadable input — driven through `invoke()` with both streams captured.
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

/** A tsconfig with a line comment, a block comment and trailing commas. */
const TSCONFIG = '{\n\t// strict mode\n\t"strict": true, /* on */\n\t"lib": ["es2024",],\n}\n';

/** A document missing the colon after `"b"`, on line 3, column 6. */
const BROKEN = '{\n\t"a": 1,\n\t"b" 2\n}\n';

afterEach(async () => {
	for (let dir of CREATED_DIRS.splice(0)) {
		await rm(dir, { recursive: true, force: true });
	}
});

/** A temporary directory holding `tsconfig.json` with `text`, removed after the test. */
async function writeConfig(text: string): Promise<string> {
	let dir = await mkdtemp(join(tmpdir(), "jsonc-cli-"));
	CREATED_DIRS.push(dir);
	await writeFile(join(dir, "tsconfig.json"), text, "utf8");
	return dir;
}

describe("sdxc-jsonc check", () => {
	test("confirms a valid file and exits 0", async () => {
		let cwd = await writeConfig(TSCONFIG);
		let run = await invoke(cli, ["check", "tsconfig.json"], { cwd });
		expect(run).toMatchObject({
			code: 0,
			stdout: "tsconfig.json is valid JSONC\n",
			stderr: "",
		});
	});

	test("prints file:line:column for a parse error and exits 1", async () => {
		let cwd = await writeConfig(BROKEN);
		let run = await invoke(cli, ["check", "tsconfig.json"], { cwd });
		expect(run).toMatchObject({
			code: 1,
			stdout: "tsconfig.json:3:6: Expected ':' after a property name\n",
		});
	});

	test("reads stdin when the file is absent or -", async () => {
		let absent = await invoke(cli, ["check"], { stdin: BROKEN });
		let dash = await invoke(cli, ["check", "-"], { stdin: TSCONFIG });
		expect(absent).toMatchObject({
			code: 1,
			stdout: "<stdin>:3:6: Expected ':' after a property name\n",
		});
		expect(dash).toMatchObject({ code: 0, stdout: "<stdin> is valid JSONC\n" });
	});

	test("an unterminated block comment points at where it opens", async () => {
		let run = await invoke(cli, ["check"], { stdin: '{ "a": 1 }\n/* note' });
		expect(run).toMatchObject({ code: 1, stdout: "<stdin>:2:1: Unterminated block comment\n" });
	});

	test("--json prints the errors with their positions", async () => {
		let invalid = await invoke(cli, ["check", "--json"], { stdin: BROKEN });
		let valid = await invoke(cli, ["check", "--json"], { stdin: TSCONFIG });
		expect(invalid.code).toBe(1);
		expect(JSON.parse(invalid.stdout)).toEqual({
			valid: false,
			errors: [
				{
					line: 3,
					column: 6,
					offset: 16,
					reason: "Expected ':' after a property name",
					message: "Expected ':' after a property name at line 3, column 6",
				},
			],
		});
		expect(valid.code).toBe(0);
		expect(JSON.parse(valid.stdout)).toEqual({ valid: true, errors: [] });
	});

	test("a missing file exits 2 naming it", async () => {
		let cwd = await writeConfig("{}");
		let run = await invoke(cli, ["check", "missing.json"], { cwd });
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("Cannot read missing.json");
	});
});

describe("sdxc-jsonc strip", () => {
	test("prints the same-length JSON, keeping every line and column", async () => {
		let cwd = await writeConfig(TSCONFIG);
		let run = await invoke(cli, ["strip", "tsconfig.json"], { cwd });
		expect(run.code).toBe(0);
		expect(run.stdout).toHaveLength(TSCONFIG.length);
		expect(run.stdout.split("\n")).toHaveLength(TSCONFIG.split("\n").length);
		expect(JSON.parse(run.stdout)).toEqual({ strict: true, lib: ["es2024"] });
	});

	test("--indent reformats the value", async () => {
		let two = await invoke(cli, ["strip", "--indent", "2"], { stdin: TSCONFIG });
		let zero = await invoke(cli, ["strip", "-", "--indent", "0"], { stdin: TSCONFIG });
		expect(two).toMatchObject({
			code: 0,
			stdout: '{\n  "strict": true,\n  "lib": [\n    "es2024"\n  ]\n}\n',
		});
		expect(zero).toMatchObject({ code: 0, stdout: '{"strict":true,"lib":["es2024"]}\n' });
	});

	test("an indent outside 0-10 is a usage error", async () => {
		let run = await invoke(cli, ["strip", "--indent", "11"], { stdin: TSCONFIG });
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
	});

	test("text that is not JSONC exits 2 with its position and nothing on stdout", async () => {
		let run = await invoke(cli, ["strip"], { stdin: BROKEN });
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("<stdin>:3:6: Expected ':' after a property name");
	});
});
