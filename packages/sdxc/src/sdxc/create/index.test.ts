/**
 * `sdxc create` end to end against a built-in template: what it writes, when it asks about
 * git, the next steps it prints, and the type check every built-in template must pass once
 * materialized as a consumer's project.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { success, unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { materialize, typecheck } from "../testing.js";

import type { Git } from "./git.js";

import { builtinTemplates, defaultPackageRoot } from "./templates.js";

import type { CreateOptions } from "./index.js";

import { CREATE_USAGE, create } from "./index.js";

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

/** A git that records the directories it initialized instead of running. */
function fakeGit(available = true): Git & { initialized: string[] } {
	let initialized: string[] = [];
	return {
		initialized,
		available: async () => available,
		init: async (directory) => {
			initialized.push(directory);
			return success(undefined);
		},
	};
}

/** Runs `create` with `argv` in `cwd` and answers the exit code and both streams. */
async function invoke(argv: string[], cwd: string, options: CreateOptions = {}) {
	let stdout = "";
	let stderr = "";
	let code = await create(
		argv,
		{
			cwd,
			stdout: (text) => {
				stdout += text;
			},
			stderr: (text) => {
				stderr += text;
			},
		},
		{ userAgent: "bun/1.3.0", confirm: async () => null, ...options },
	);
	return { code, stdout, stderr };
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
		let git = fakeGit();

		let result = await invoke(["blog"], cwd, { git });

		expect(result).toEqual({
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
		expect(git.initialized).toEqual([]);
	});

	test("asks before initializing git in a directory it made, and runs it on yes", async () => {
		let cwd = await temporary();
		let git = fakeGit();
		let questions: string[] = [];

		let result = await invoke(["blog"], cwd, {
			git,
			confirm: async (question) => {
				questions.push(question);
				return true;
			},
		});

		expect(questions).toEqual(["Initialize a git repository in blog?"]);
		expect(git.initialized).toEqual([join(cwd, "blog")]);
		expect(result.stdout).toContain("Initialized a git repository\n");
	});

	test("--git answers in advance and --no-git skips the question", async () => {
		let cwd = await temporary();
		let yes = fakeGit();
		let no = fakeGit();
		let asked = false;
		let confirm = async () => {
			asked = true;
			return true;
		};

		await invoke(["one", "--git"], cwd, { git: yes, confirm });
		await invoke(["two", "--no-git"], cwd, { git: no, confirm });

		expect(asked).toBe(false);
		expect(yes.initialized).toEqual([join(cwd, "one")]);
		expect(no.initialized).toEqual([]);
	});

	test("never asks in the current directory, and notes a missing git", async () => {
		let cwd = await temporary();
		let here = await temporary();
		let git = fakeGit(false);

		let current = await invoke([], here, { git: fakeGit(), confirm: async () => true });
		let missing = await invoke(["blog", "--git"], cwd, { git });

		expect(current.stdout).toBe(
			[
				`Created ${current.stdout.split(" ")[1]} from the app template`,
				"",
				"Next steps:",
				"  bun install",
				"  bun dev",
				"",
			].join("\n"),
		);
		expect(missing.stdout).toContain("git is not on the PATH, so no repository was initialized\n");
	});

	test("refuses a directory that already holds files, writing nothing", async () => {
		let cwd = await temporary();
		await mkdir(join(cwd, "blog"));
		await writeFile(join(cwd, "blog/notes.txt"), "");

		let result = await invoke(["blog"], cwd);

		expect(result.code).toBe(1);
		expect(result.stderr).toBe(
			`${join(cwd, "blog")} is not empty (notes.txt); sdxc create needs an empty directory\n`,
		);
		expect(await exists(join(cwd, "blog/package.json"))).toBe(false);
	});

	test("exits 2 for usage errors and 1 for a reserved host", async () => {
		let cwd = await temporary();

		let both = await invoke(["blog", "--git", "--no-git"], cwd);
		let two = await invoke(["a", "b"], cwd);
		let host = await invoke(["blog", "--template", "gitlab:acme/app"], cwd);
		let help = await invoke(["--help"], cwd);

		expect(both.code).toBe(2);
		expect(two.code).toBe(2);
		expect(host).toMatchObject({ code: 1 });
		expect(host.stderr).toContain('Template host "gitlab:" is not supported');
		expect(help).toEqual({ code: 0, stdout: CREATE_USAGE, stderr: "" });
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
