/**
 * Tests for `sdxc ci`: finding the script from the project or a workspace below it, the
 * frozen-lockfile install a local run starts with, scoping a run to the workspace it starts in,
 * cleaning the stored runs, and the root-owned CI files a monorepo project leaves out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { locateCI } from "../../ci/locate.js";
import { createSDXC } from "../../cli.js";
import { dropRootOwned, insideWorkspace } from "../../create/workspace.js";

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

/** The environment of a local run: no CI variable. */
const ENV = { CI: "" };

/** A script testing every workspace, needing no import so the fixture resolves nothing. */
const SCRIPT = `export default async (ci) => {
	await ci.step("Lint", "true");
	await ci.matrix("Workspaces", await ci.workspaces(), (ws) => ci.step("Test", "true"));
};
`;

afterEach(async () => {
	await Promise.all(PROJECTS.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A committed monorepo on Bun whose app depends on its package, holding `files` too. */
async function monorepo(files: Record<string, string> = {}): Promise<string> {
	let root = await realpath(await mkdtemp(join(tmpdir(), "sdxc-ci-")));
	PROJECTS.push(root);
	let all: Record<string, string> = {
		"package.json": JSON.stringify({
			workspaces: ["apps/*", "packages/*"],
			packageManager: "bun@1.4.2",
		}),
		"apps/blog/package.json": JSON.stringify({ name: "blog", dependencies: { ui: "workspace:*" } }),
		"packages/ui/package.json": JSON.stringify({ name: "ui" }),
		"packages/jwt/package.json": JSON.stringify({ name: "jwt" }),
		...files,
	};
	for (let [path, content] of Object.entries(all)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	execFileSync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: root });
	return root;
}

describe("locateCI", () => {
	test("finds the script at the project root, and the workspace a run starts in", async () => {
		let root = await monorepo({ ".config/sdxc/ci.ts": SCRIPT });
		let atRoot = unwrap(await locateCI(root));
		let inApp = unwrap(await locateCI(join(root, "apps/blog")));
		expect(atRoot).toEqual({ root, script: join(root, ".config/sdxc/ci.ts"), workspace: null });
		expect(inApp).toEqual({
			root,
			script: join(root, ".config/sdxc/ci.ts"),
			workspace: "apps/blog",
		});
	});

	test("reads ci.script from the project's configuration", async () => {
		let root = await monorepo({
			".config/sdxc.jsonc": JSON.stringify({ ci: { script: "ci/main.ts" } }),
			"ci/main.ts": SCRIPT,
		});
		expect(unwrap(await locateCI(root)).script).toBe(join(root, "ci/main.ts"));
	});

	test("fails naming the default path when no project has a script", async () => {
		let root = await monorepo();
		let located = await locateCI(root);
		expect(located.status).toBe("failure");
		if (located.status === "failure") expect(located.error.message).toContain(".config/sdxc/ci.ts");
	});
});

describe("sdxc ci", () => {
	test("installs with a frozen lockfile, then runs the script", async () => {
		let root = await monorepo({ ".config/sdxc/ci.ts": SCRIPT });
		let run = await invoke(createSDXC(), ["ci", "--no-signoff"], {
			cwd: root,
			env: ENV,
			exec: { "bun install --frozen-lockfile": {} },
		});
		expect(run.code).toBe(0);
		expect(run.exec.map((call) => call.command.join(" "))).toEqual([
			"bun install --frozen-lockfile",
		]);
		expect(run.stdout).toContain("Installing dependencies: bun install --frozen-lockfile\n");
		expect(run.stdout).toContain("✓ Workspaces/jwt › Test");
	});

	test("a failed install exits 1 before the script runs", async () => {
		let root = await monorepo({ ".config/sdxc/ci.ts": SCRIPT });
		let run = await invoke(createSDXC(), ["ci"], {
			cwd: root,
			env: ENV,
			exec: { "bun install --frozen-lockfile": { code: 1, stderr: "lockfile had changes\n" } },
		});
		expect(run.code).toBe(1);
		expect(run.stdout).not.toContain("Lint");
		expect(run.stderr).toContain("the CI script did not run");
	});

	test("a remote run and --no-install skip the install", async () => {
		let root = await monorepo({ ".config/sdxc/ci.ts": SCRIPT });
		let remote = await invoke(createSDXC(), ["ci"], { cwd: root, env: { CI: "true" } });
		let skipped = await invoke(createSDXC(), ["ci", "--no-install", "--no-signoff"], {
			cwd: root,
			env: ENV,
		});
		expect([remote.code, skipped.code]).toEqual([0, 0]);
		expect([...remote.exec, ...skipped.exec]).toEqual([]);
	});

	test("a run started in a package covers it and its dependents only", async () => {
		let root = await monorepo({ ".config/sdxc/ci.ts": SCRIPT });
		let run = await invoke(createSDXC(), ["ci", "list", "--matrix", "Workspaces", "--json"], {
			cwd: join(root, "packages/ui"),
			env: ENV,
		});
		expect(JSON.parse(run.stdout)).toEqual(["blog", "ui"]);
	});

	test("exits 2 without a script", async () => {
		let root = await monorepo();
		let run = await invoke(createSDXC(), ["ci", "--no-install"], { cwd: root, env: ENV });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("No CI script");
	});

	test("clean empties the cache and run history from any workspace, keeping signoffs", async () => {
		let root = await monorepo();
		let store = join(root, ".git", "sdxc-ci");
		await mkdir(join(store, "cache"), { recursive: true });
		await writeFile(join(store, "cache", "key.json"), "{}");
		await writeFile(join(store, "abc123.json"), "{}");
		let run = await invoke(createSDXC(), ["ci", "clean", "--json"], {
			cwd: join(root, "packages/ui"),
			env: ENV,
		});
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toMatchObject({ files: 1, bytes: 2 });
		expect(await readdir(store)).toEqual(["abc123.json"]);
	});
});

describe("projects created inside a monorepo", () => {
	test("are detected from a package.json declaring workspaces above them", async () => {
		let root = await monorepo();
		expect(await insideWorkspace(join(root, "apps/new"))).toBe(true);
		expect(await insideWorkspace(join(tmpdir(), "standalone-app"))).toBe(false);
	});

	test("leave out the CI script and the GitHub workflows", () => {
		let tree = {
			files: new Map([
				[".config/sdxc/ci.ts", new Uint8Array()],
				[".config/sdxc.jsonc", new Uint8Array()],
				[".github/workflows/ci.yml", new Uint8Array()],
				["package.json", new Uint8Array()],
			]),
			directories: new Set([".github"]),
		};
		dropRootOwned(tree);
		expect([...tree.files.keys()]).toEqual([".config/sdxc.jsonc", "package.json"]);
		expect([...tree.directories]).toEqual([]);
	});
});
