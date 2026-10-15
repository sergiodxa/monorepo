/**
 * `sdxc create` end to end against a built-in template: what it writes, the questions it asks
 * on a terminal and the defaults it takes without one, when it runs git, the next steps it
 * prints, and the type check every built-in template must pass once materialized.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { InvokeOptions } from "@sdxc/cli/test";

import { invoke } from "@sdxc/cli/test";
import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";
import { builtinTemplates, defaultPackageRoot } from "../create/templates.js";
import { materialize, typecheck } from "../testing.js";

/** Every built-in template, each type checked once materialized. */
const TEMPLATES = unwrap(await builtinTemplates(defaultPackageRoot()));

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A fresh temporary directory to run `create` from. */
async function temporary(): Promise<string> {
	let dir = await mkdtemp(join(tmpdir(), "sdxc-create-"));
	DIRECTORIES.push(dir);
	return dir;
}

/**
 * Runs `sdxc create` with `argv` in `cwd` as Bun would start it. Without a terminal unless
 * `options` scripts answers; `git` is on the `PATH` and `git init` succeeds unless `options`
 * replies otherwise.
 */
function create(argv: string[], cwd: string, options: InvokeOptions = {}) {
	return invoke(createSDXC(), ["create", ...argv], {
		cwd,
		env: { npm_config_user_agent: "bun/1.3.0" },
		interactive: false,
		exec: { "git --version": {}, "git init --quiet": {} },
		...options,
	});
}

/** Whether `path` exists. */
async function exists(path: string): Promise<boolean> {
	return stat(path).then(
		() => true,
		() => false,
	);
}

describe("create", () => {
	test("writes the app template into a new directory and prints the next steps", async () => {
		let cwd = await temporary();

		let result = await create(["blog"], cwd);

		expect(result).toMatchObject({
			code: 0,
			stdout: [
				"Created blog from the app template",
				"",
				"Next steps:",
				"  cd blog",
				"  bun install",
				"  bun dev",
				"",
			].join("\n"),
			stderr: "",
		});
		let manifest = await readFile(join(cwd, "blog/package.json"), "utf8");
		expect(manifest).toContain('"name": "blog"');
		expect(await exists(join(cwd, "blog/bootstrap/worker.ts"))).toBe(true);
		expect(await exists(join(cwd, "blog/.config/sdxc.jsonc"))).toBe(true);
		expect(result.exec.map((call) => call.command.join(" "))).toEqual(["git --version"]);
	});

	test("on a terminal, asks for the directory, the template and git, and runs git on yes", async () => {
		let cwd = await temporary();

		let result = await create([], cwd, {
			interactive: true,
			answers: { directory: "blog", template: "app", git: true },
		});

		expect(result.code).toBe(0);
		expect(result.stderr).toBe(
			[
				"✓ Where should the project go? blog",
				"✓ Which template? app",
				"✓ Initialize a git repository in blog? Yes",
				"",
			].join("\n"),
		);
		expect(result.exec.map((call) => [call.command.join(" "), call.cwd])).toEqual([
			["git --version", cwd],
			["git init --quiet", join(cwd, "blog")],
		]);
		expect(result.stdout).toContain("Initialized a git repository\n");
	});

	test("without a terminal, takes the current directory and the app template, and skips git", async () => {
		let here = await temporary();

		let result = await create([], here);

		expect(result.code).toBe(0);
		expect(result.stdout).toBe(
			[
				`Created ${result.stdout.split(" ")[1]} from the app template`,
				"",
				"Next steps:",
				"  bun install",
				"  bun dev",
				"",
			].join("\n"),
		);
		expect(result.exec).toEqual([]);
	});

	test("--git answers in advance and --no-git skips the question", async () => {
		let cwd = await temporary();

		let answers = { template: "app" };
		let yes = await create(["one", "--git"], cwd, { interactive: true, answers });
		let no = await create(["two", "--no-git"], cwd, { interactive: true, answers });

		expect(yes.exec.map((call) => call.command.join(" "))).toEqual([
			"git --version",
			"git init --quiet",
		]);
		expect(no.exec).toEqual([]);
	});

	test("never asks in an existing directory, and notes a missing git", async () => {
		let cwd = await temporary();
		let here = await temporary();

		let current = await create(["."], here, { interactive: true, answers: { template: "app" } });
		let missing = await create(["blog", "--git"], cwd, {
			exec: { "git --version": { code: 127 } },
		});

		expect(current.code).toBe(0);
		expect(current.exec).toEqual([]);
		expect(missing.stdout).toContain("git is not on the PATH, so no repository was initialized\n");
	});

	test("refuses a directory that already holds files, writing nothing", async () => {
		let cwd = await temporary();
		await mkdir(join(cwd, "blog"));
		await writeFile(join(cwd, "blog/notes.txt"), "");

		let result = await create(["blog"], cwd);

		expect(result.code).toBe(1);
		expect(result.stderr).toBe(
			`${join(cwd, "blog")} is not empty (notes.txt); sdxc create needs an empty directory\n`,
		);
		expect(await exists(join(cwd, "blog/package.json"))).toBe(false);
	});

	test("exits 2 for usage errors and 1 for a reserved host", async () => {
		let cwd = await temporary();

		let both = await create(["blog", "--git", "--no-git"], cwd);
		let two = await create(["a", "b"], cwd);
		let host = await create(["blog", "--template", "gitlab:acme/app"], cwd);
		let help = await create(["--help"], cwd);

		expect(both.code).toBe(2);
		expect(both.stderr).toMatch(/^--git and --no-git cannot be passed together\n/);
		expect(two.code).toBe(2);
		expect(host).toMatchObject({ code: 1 });
		expect(host.stderr).toContain('Template host "gitlab:" is not supported');
		expect(help.code).toBe(0);
		expect(help.stdout).toContain("Usage: sdxc create [directory] [options]");
		expect(help.stdout).toContain("--template <template>");
	});
});

describe("built-in templates type check as a consumer's project", () => {
	test.each(TEMPLATES)("%s", { timeout: 120_000 }, async (template) => {
		let project = unwrap(await materialize(template));
		DIRECTORIES.push(dirname(project));

		let result = await typecheck(project);

		expect(result.output).toBe("");
		expect(result.code).toBe(0);
	});
});
