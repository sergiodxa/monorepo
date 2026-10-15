/**
 * The `sdxc` command line end to end through `invoke()`: the help generated from the contract,
 * usage errors and their exit codes, and `init` reaching the project root from a nested
 * working directory through the `project()` middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { createSDXC } from "./cli.js";
import { BUILTIN_TEMPLATES, builtinTemplates, defaultPackageRoot } from "./create/templates.js";

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** An empty project with a nested `src/` to run from. */
async function project(): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-cli-"));
	PROJECTS.push(root);
	await writeFile(join(root, "package.json"), "{}");
	await mkdir(join(root, "src"));
	return root;
}

describe("help", () => {
	test("lists every command from the contract and exits 0", async () => {
		let result = await invoke(createSDXC({ version: "2026.10.15" }), ["--help"]);

		expect(result.code).toBe(0);
		expect(result.stdout).toBe(
			[
				"Usage: sdxc <command> [options]",
				"",
				"Commands:",
				"  create   Write a new project from a built-in template or a GitHub repository",
				"  init     Write .config/sdxc.jsonc with every default spelled out",
				"  make     Write a controller, job, model or other file where the app layout puts it",
				"  ui       Copy @sdxc/ui components into the project and keep imports on the copies",
				"  upgrade  Move to another sdxc release and print the prompt for the code",
				"",
				"Options:",
				"  --version   Print the version",
				"  -h, --help  Show this help",
				"",
			].join("\n"),
		);
		expect((await invoke(createSDXC({ version: "2026.10.15" }), ["--version"])).stdout).toBe(
			"2026.10.15\n",
		);
	});

	test("exits 2 with the help for no command, an unknown one, or an unknown flag", async () => {
		let root = await project();
		let cli = createSDXC();

		let none = await invoke(cli, [], { cwd: root });
		let unknown = await invoke(cli, ["deploy"], { cwd: root });
		let flag = await invoke(cli, ["init", "--force"], { cwd: root });

		expect(none.code).toBe(2);
		expect(none.stderr).toContain("Usage: sdxc <command> [options]");
		expect(unknown.code).toBe(2);
		expect(unknown.stderr).toMatch(/^Unknown command "deploy" for sdxc\n\nUsage: sdxc <command>/);
		expect(flag.code).toBe(2);
		expect(flag.stderr).toMatch(
			/^--force is not a flag of sdxc init; sdxc ui update takes it\n\nUsage: sdxc init \[options\]/,
		);
		expect(await readdir(root)).toEqual(["package.json", "src"]);
	});

	test("offers every built-in template the package ships", async () => {
		expect(BUILTIN_TEMPLATES).toEqual(unwrap(await builtinTemplates(defaultPackageRoot())));
	});
});

describe("sdxc init", () => {
	test("writes the configuration at the project root from a nested directory", async () => {
		let root = await project();

		let result = await invoke(createSDXC(), ["init"], { cwd: join(root, "src") });

		expect(result).toMatchObject({ code: 0, stdout: "Wrote .config/sdxc.jsonc\n", stderr: "" });
		expect(await readFile(join(root, ".config/sdxc.jsonc"), "utf8")).toContain('"lock"');
	});

	test("--dry-run prints the file instead of writing it", async () => {
		let root = await project();

		let result = await invoke(createSDXC(), ["init", "--dry-run"], { cwd: root });

		expect(result.code).toBe(0);
		expect(result.stdout).toMatch(/^Would write \.config\/sdxc\.jsonc:\n\n\{\n/);
		expect(await readdir(root)).toEqual(["package.json", "src"]);
	});

	test("exits 1 naming the configuration that already exists", async () => {
		let root = await project();
		await writeFile(join(root, "sdxc.jsonc"), "{}");

		let result = await invoke(createSDXC(), ["init"], { cwd: root });

		expect(result).toMatchObject({
			code: 1,
			stdout: "",
			stderr: "sdxc.jsonc already exists; sdxc init leaves it as it is\n",
		});
	});

	test("exits 1 outside a project", async () => {
		let outside = await mkdtemp(join(tmpdir(), "sdxc-cli-outside-"));
		PROJECTS.push(outside);

		let result = await invoke(createSDXC(), ["init"], { cwd: outside });

		expect(result.code).toBe(1);
		expect(result.stderr).toMatch(/^No package\.json at or above .*; run sdxc inside a project\n$/);
	});
});
