/**
 * The command line end to end through `run`: dispatch, usage errors and their exit codes, and
 * `init` reaching the project root from a nested working directory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { USAGE, run } from "./run.js";

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** An empty project with a nested `src/` to run from. */
async function project(): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-run-"));
	PROJECTS.push(root);
	await writeFile(join(root, "package.json"), "{}");
	await mkdir(join(root, "src"));
	return root;
}

/** Runs `argv` in `cwd` and answers the exit code with everything written to each stream. */
async function invoke(argv: string[], cwd: string) {
	let stdout = "";
	let stderr = "";
	let code = await run(argv, {
		cwd,
		stdout: (text) => {
			stdout += text;
		},
		stderr: (text) => {
			stderr += text;
		},
	});
	return { code, stdout, stderr };
}

describe("run", () => {
	test("prints the usage on --help and exits 0", async () => {
		expect(await invoke(["--help"], await project())).toEqual({
			code: 0,
			stdout: USAGE,
			stderr: "",
		});
	});

	test("exits 2 with the usage for no command, an unknown one, or an unknown flag", async () => {
		let root = await project();

		let none = await invoke([], root);
		let unknown = await invoke(["deploy"], root);
		let flag = await invoke(["init", "--force"], root);

		expect(none).toEqual({ code: 2, stdout: "", stderr: USAGE });
		expect(unknown.code).toBe(2);
		expect(unknown.stderr).toBe(`Unknown command: deploy\n\n${USAGE}`);
		expect(flag.code).toBe(2);
		expect(flag.stderr).toContain("--force");
	});

	test("init writes the configuration at the project root from a nested directory", async () => {
		let root = await project();

		let result = await invoke(["init"], join(root, "src"));

		expect(result).toEqual({ code: 0, stdout: "Wrote .config/sdxc.jsonc\n", stderr: "" });
		expect(await readFile(join(root, ".config/sdxc.jsonc"), "utf8")).toContain('"lock"');
	});

	test("init --dry-run prints the file instead of writing it", async () => {
		let root = await project();

		let result = await invoke(["init", "--dry-run"], root);

		expect(result.code).toBe(0);
		expect(result.stdout).toMatch(/^Would write \.config\/sdxc\.jsonc:\n\n\{\n/);
	});

	test("init exits 1 naming the configuration that already exists", async () => {
		let root = await project();
		await writeFile(join(root, "sdxc.jsonc"), "{}");

		let result = await invoke(["init"], root);

		expect(result).toEqual({
			code: 1,
			stdout: "",
			stderr: "sdxc.jsonc already exists; sdxc init leaves it as it is\n",
		});
	});
});
