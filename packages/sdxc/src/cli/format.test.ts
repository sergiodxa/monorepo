/**
 * The `format` runner: the configured command spawned without a shell, the written paths
 * appended, and every way it can fail reported with the command it ran.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure, isSuccess } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { runFormat } from "./format.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A fresh temporary directory to run the command in. */
async function temporary(): Promise<string> {
	let dir = await mkdtemp(join(tmpdir(), "sdxc-format-"));
	DIRECTORIES.push(dir);
	return dir;
}

/** A script that records its arguments to `argv.json` in the directory it runs in. */
const RECORD_ARGUMENTS =
	"require('fs').writeFileSync('argv.json', JSON.stringify({ argv: process.argv.slice(1) }))";

describe("runFormat", () => {
	test("runs the command in the root with the paths appended as separate arguments", async () => {
		let root = await temporary();

		let result = await runFormat(
			[process.execPath, "-e", RECORD_ARGUMENTS],
			["src/a b.ts", "src/$(rm).ts"],
			root,
		);

		expect(isSuccess(result)).toBe(true);
		let recorded = JSON.parse(await readFile(join(root, "argv.json"), "utf8")) as {
			argv: string[];
		};
		expect(recorded.argv).toEqual(["src/a b.ts", "src/$(rm).ts"]);
	});

	test("runs nothing without a command or without a path", async () => {
		let root = await temporary();

		expect(isSuccess(await runFormat(undefined, ["a.ts"], root))).toBe(true);
		expect(isSuccess(await runFormat([process.execPath, "-e", RECORD_ARGUMENTS], [], root))).toBe(
			true,
		);
		await expect(readFile(join(root, "argv.json"), "utf8")).rejects.toThrow();
	});

	test("reports a non-zero exit, leaving the files as written", async () => {
		let root = await temporary();

		let result = await runFormat([process.execPath, "-e", "process.exit(3)"], ["a.ts"], root);

		expect(isFailure(result) && result.error.message).toBe(
			`format command \`${process.execPath} -e process.exit(3)\` exited with 3; the files stay as written`,
		);
	});

	test("reports a command that cannot start", async () => {
		let root = await temporary();

		let result = await runFormat(["sdxc-no-such-formatter"], ["a.ts"], root);

		expect(isFailure(result) && result.error.message).toMatch(
			/^format command `sdxc-no-such-formatter` could not start: .*ENOENT/,
		);
	});
});
