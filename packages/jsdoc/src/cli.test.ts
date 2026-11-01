/**
 * Tests for the `sdxc-jsdoc` command line: what `extract` prints on each stream and the exit
 * code it answers for files, directories, piped stdin, a file that does not parse and a missing
 * path, driven through `invoke()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

import type { DocProject } from "./index.js";

import { SCHEMA_VERSION } from "./index.js";

const ADD = "/** Adds two numbers. */\nexport function add(a: number, b: number) {}\n";

const SECRET = "/** @internal */\nexport const secret = 1;\n";

const BROKEN = "export function (\n";

/** The directory each test runs in, holding a package with `src/` and `broken.ts`. */
const FIXTURE = { dir: "" };

beforeEach(async () => {
	FIXTURE.dir = await mkdtemp(join(tmpdir(), "sdxc-jsdoc-"));
	await mkdir(join(FIXTURE.dir, "src/nested"), { recursive: true });
	await mkdir(join(FIXTURE.dir, "src/node_modules/dep"), { recursive: true });
	await writeFile(join(FIXTURE.dir, "package.json"), '{"name":"math","version":"1.4.0"}');
	await writeFile(join(FIXTURE.dir, "src/add.ts"), ADD);
	await writeFile(join(FIXTURE.dir, "src/nested/secret.ts"), SECRET);
	await writeFile(join(FIXTURE.dir, "src/notes.md"), "# Notes\n");
	await writeFile(join(FIXTURE.dir, "src/node_modules/dep/index.js"), ADD);
	await writeFile(join(FIXTURE.dir, "broken.ts"), BROKEN);
});

afterEach(async () => {
	await rm(FIXTURE.dir, { recursive: true, force: true });
});

/** Runs `sdxc-jsdoc` in the fixture directory with no terminal attached. */
function run(argv: string[], stdin?: string) {
	return invoke(cli, argv, { cwd: FIXTURE.dir, stdin, interactive: false });
}

/** The project a run printed. */
function project(stdout: string): DocProject {
	return JSON.parse(stdout) as DocProject;
}

describe("sdxc-jsdoc extract", () => {
	test("documents a file as a project named after package.json", async () => {
		let { code, stdout, stderr } = await run(["extract", "src/add.ts"]);

		expect(code).toBe(0);
		expect(stderr).toBe("");
		let doc = project(stdout);
		expect(doc).toMatchObject({ schema: SCHEMA_VERSION, name: "math", version: "1.4.0" });
		expect(doc.modules.map((module) => module.path)).toEqual(["src/add.ts"]);
		expect(doc.modules[0]?.children[0]).toMatchObject({ id: "src/add#add", kind: "function" });
	});

	test("walks a directory for source files, skipping node_modules and other files", async () => {
		let { code, stdout } = await run(["extract", "src"]);

		expect(code).toBe(0);
		expect(project(stdout).modules.map((module) => module.path)).toEqual([
			"src/add.ts",
			"src/nested/secret.ts",
		]);
	});

	test("reads a file reached twice once", async () => {
		let { stdout } = await run(["extract", "src/add.ts", "src"]);

		expect(project(stdout).modules.map((module) => module.path)).toEqual([
			"src/add.ts",
			"src/nested/secret.ts",
		]);
	});

	test("drops @internal symbols unless --include-internal", async () => {
		let dropped = await run(["extract", "src/nested/secret.ts"]);
		let kept = await run(["extract", "src/nested/secret.ts", "--include-internal"]);

		expect(project(dropped.stdout).modules[0]?.children).toEqual([]);
		expect(project(kept.stdout).modules[0]?.children.map((node) => node.name)).toEqual(["secret"]);
	});

	test("reads stdin under --stdin-path when the path is absent or -", async () => {
		let absent = await run(["extract"], ADD);
		let dash = await run(["extract", "-", "--stdin-path", "src/add.ts"], ADD);

		expect(absent.code).toBe(0);
		expect(project(absent.stdout).modules[0]?.children[0]?.id).toBe("module#add");
		expect(project(dash.stdout).modules[0]?.children[0]?.id).toBe("src/add#add");
	});

	test("names the project with --name and --project-version", async () => {
		let { stdout } = await run([
			"extract",
			"src/add.ts",
			"--name",
			"adder",
			"--project-version",
			"2.0.0",
		]);

		expect(project(stdout)).toMatchObject({ name: "adder", version: "2.0.0" });
	});

	test("writes to --output and leaves stdout empty", async () => {
		let { code, stdout, stderr } = await run(["extract", "src", "--output", "docs.json"]);

		expect(code).toBe(0);
		expect(stdout).toBe("");
		expect(stderr).toBe("Wrote 2 modules to docs.json\n");
		let written = await readFile(join(FIXTURE.dir, "docs.json"), "utf8");
		expect(project(written).modules).toHaveLength(2);
	});

	test("lists each syntax error and exits 1 without printing the project", async () => {
		let { code, stdout, stderr } = await run(["extract", "src/add.ts", "broken.ts"]);

		expect(code).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toMatch(/^broken\.ts:1:\d+ /m);
		expect(stderr).toContain("1 file did not parse; pass --keep-going to extract the rest");
	});

	test("prints the modules that parsed with --keep-going", async () => {
		let { code, stdout, stderr } = await run([
			"extract",
			"src/add.ts",
			"broken.ts",
			"--keep-going",
		]);

		expect(code).toBe(0);
		expect(project(stdout).modules.map((module) => module.path)).toEqual(["src/add.ts"]);
		expect(stderr).toMatch(/^broken\.ts:1:\d+ /m);
		expect(stderr).toContain("Left out 1 file that did not parse");
	});

	test("exits 2 naming a path it cannot read", async () => {
		let { code, stdout, stderr } = await run(["extract", "missing.ts"]);

		expect(code).toBe(2);
		expect(stdout).toBe("");
		expect(stderr).toContain("Cannot read missing.ts");
	});
});
