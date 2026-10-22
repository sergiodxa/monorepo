/**
 * The `format` runner: the configured command spawned without a shell as a task, the written
 * paths appended, and every way it can fail reported with the command it ran.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { argument, command, commands, createCLI, createCommand, spawnExec } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import * as s from "remix/data-schema";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { formatFiles } from "./format.js";

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

/** A command line whose one command formats the paths it is given with `program`. */
function formatter(program: readonly string[] | undefined) {
	let contract = commands({
		format: command({ arguments: { paths: argument.variadic(s.string()) } }),
	});
	let cli = createCLI({ name: "test", commands: contract });
	cli.map(
		contract.format,
		createCommand(contract.format, (ctx) =>
			formatFiles(ctx, program, ctx.arguments.paths, ctx.cwd),
		),
	);
	return cli;
}

/** Formats `paths` in `root` with `command`, spawning it for real. */
function runFormat(program: readonly string[] | undefined, paths: string[], root: string) {
	return invoke(formatter(program), ["format", ...paths], { cwd: root, exec: spawnExec });
}

/** A script that records its arguments to `argv.json` in the directory it runs in. */
const RECORD_ARGUMENTS =
	"require('fs').writeFileSync('argv.json', JSON.stringify({ argv: process.argv.slice(1) }))";

describe("formatFiles", () => {
	test("runs the command in the root with the paths appended as separate arguments", async () => {
		let root = await temporary();

		let result = await runFormat(
			[process.execPath, "-e", RECORD_ARGUMENTS],
			["src/a b.ts", "src/$(rm).ts"],
			root,
		);

		expect(result.code).toBe(0);
		expect(result.stderr).toBe("Formatting 2 files\n✓ Formatting 2 files\n");
		let recorded = JSON.parse(await readFile(join(root, "argv.json"), "utf8")) as {
			argv: string[];
		};
		expect(recorded.argv).toEqual(["src/a b.ts", "src/$(rm).ts"]);
	});

	test("runs nothing without a command or without a path", async () => {
		let root = await temporary();

		expect(await runFormat(undefined, ["a.ts"], root)).toMatchObject({ code: 0, stderr: "" });
		expect(await runFormat([process.execPath, "-e", RECORD_ARGUMENTS], [], root)).toMatchObject({
			code: 0,
			stderr: "",
			exec: [],
		});
		await expect(readFile(join(root, "argv.json"), "utf8")).rejects.toThrow();
	});

	test("reports a non-zero exit, leaving the files as written", async () => {
		let root = await temporary();

		let result = await runFormat([process.execPath, "-e", "process.exit(3)"], ["a.ts"], root);

		expect(result.code).toBe(1);
		expect(result.stderr).toBe(
			`Formatting 1 file\n✗ Formatting 1 file\nformat command \`${process.execPath} -e process.exit(3)\` exited with 3; the files stay as written\n`,
		);
	});

	test("reports a command that cannot start", async () => {
		let root = await temporary();

		let result = await runFormat(["sdxc-no-such-formatter"], ["a.ts"], root);

		expect(result.code).toBe(1);
		expect(result.stderr).toMatch(
			/\nformat command `sdxc-no-such-formatter` could not start: .*ENOENT/,
		);
	});
});
