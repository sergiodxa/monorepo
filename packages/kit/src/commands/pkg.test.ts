/**
 * Tests `sdxc pkg` as a developer meets it: a bare run lists the packages, a project's installed
 * copy or a workspace's source runs under Bun, anything else goes through `bunx` or `npx`, a
 * typo suggests the intended command without running it, and a package without a command line
 * links to where to request one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterEach, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";

/** Folders created by the current test, removed after it. */
const FOLDERS: string[] = [];

afterEach(async () => {
	let created = FOLDERS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A folder holding `files`, each path relative to it. */
async function folder(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-pkg-"));
	FOLDERS.push(root);
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** A `PATH` holding a `bun` executable, so the run sees Bun installed. */
function pathWithBun(): Promise<string> {
	return folder({ bun: "" });
}

describe("sdxc pkg", () => {
	test("lists every package with a command line when no name is given", async () => {
		let run = await invoke(createSDXC(), ["pkg"], { cwd: await folder({}) });

		expect(run.code).toBe(0);
		expect(run.stdout).toContain("Usage: sdxc pkg <name>");
		expect(run.stdout).toMatch(/\n {2}uuid +generate and validate UUIDs\n/);
	});

	test("runs a project's installed copy under Bun with every token after the name", async () => {
		let root = await folder({
			"node_modules/@sdxc/uuid/package.json": JSON.stringify({
				name: "@sdxc/uuid",
				bin: { "sdxc-uuid": "./dist/cli.js" },
			}),
		});
		let binary = join(root, "node_modules/@sdxc/uuid/dist/cli.js");

		let run = await invoke(createSDXC(), ["pkg", "uuid", "v4", "-n", "2", "--json"], {
			cwd: root,
			env: { PATH: await pathWithBun() },
			exec: { [`bun ${binary} v4 -n 2 --json`]: { code: 0 } },
		});

		expect(run.code).toBe(0);
		expect(run.exec[0]?.command).toEqual(["bun", binary, "v4", "-n", "2", "--json"]);
	});

	test("runs a workspace package's source from a folder inside the workspace", async () => {
		let root = await folder({
			"package.json": JSON.stringify({ name: "repo", workspaces: ["packages/*"] }),
			"packages/jwt/package.json": JSON.stringify({
				name: "@sdxc/jwt",
				bin: { "sdxc-jwt": "./src/cli.ts" },
			}),
			"apps/blog/package.json": JSON.stringify({ name: "blog" }),
		});
		let binary = join(root, "packages/jwt/src/cli.ts");

		let run = await invoke(createSDXC(), ["pkg", "@sdxc/jwt", "decode"], {
			cwd: join(root, "apps/blog"),
			env: { PATH: await pathWithBun() },
			exec: { [`bun ${binary} decode`]: { code: 0 } },
		});

		expect(run.code).toBe(0);
	});

	test("downloads the published package with bunx, or npx without Bun", async () => {
		let cwd = await folder({});

		let withBun = await invoke(createSDXC(), ["pkg", "sdxc-qr", "encode", "hi"], {
			cwd,
			env: { PATH: await pathWithBun() },
			exec: { "bunx --bun --package @sdxc/qr sdxc-qr encode hi": { code: 0 } },
		});
		let withoutBun = await invoke(createSDXC(), ["pkg", "qr", "encode", "hi"], {
			cwd,
			env: { PATH: await folder({}) },
			exec: { "npx --yes --package @sdxc/qr sdxc-qr encode hi": { code: 0 } },
		});

		expect(withBun.code).toBe(0);
		expect(withoutBun.code).toBe(0);
	});

	test("hands the package's exit code back", async () => {
		let run = await invoke(createSDXC(), ["pkg", "email-auth", "check", "example.com"], {
			cwd: await folder({}),
			env: { PATH: await folder({}) },
			exec: {
				"npx --yes --package @sdxc/email-auth sdxc-email-auth check example.com": { code: 1 },
			},
		});

		expect(run.code).toBe(1);
	});

	test("suggests the command a typo most likely meant, and runs nothing", async () => {
		let run = await invoke(createSDXC(), ["pkg", "uiid", "v4", "-n", "3"], {
			cwd: await folder({}),
		});

		expect(run.code).toBe(2);
		expect(run.exec).toEqual([]);
		expect(run.stderr).toContain("Did you mean `sdxc pkg uuid v4 -n 3`?");
	});

	test("points to the list when nothing is close", async () => {
		let run = await invoke(createSDXC(), ["pkg", "zzz"], { cwd: await folder({}) });

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Run `sdxc pkg` to list them.");
	});

	test("links a package without a command line to a request titled with its name only", async () => {
		let run = await invoke(createSDXC(), ["pkg", "yaml", "parse", "secrets.yaml"], {
			cwd: await folder({}),
		});

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("@sdxc/yaml has no command line yet.");
		expect(run.stderr).toContain(
			"https://github.com/sergiodxa/monorepo/discussions/new?category=ideas&title=Command%20line%20for%20%40sdxc%2Fyaml",
		);
		expect(run.stderr).not.toContain("secrets.yaml");
	});
});
