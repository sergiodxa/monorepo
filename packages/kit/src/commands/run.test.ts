/**
 * Tests `sdxc run` as a developer meets it: the app's own command line receives every token
 * after `run`, it runs under the project's runtime, its exit code becomes `sdxc run`'s, and a
 * project without `bootstrap/cli.ts` gets a message naming the file.
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

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A project holding `files`, each path relative to its root. */
async function project(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-run-"));
	PROJECTS.push(root);
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** An app with a command line, on the package manager `packageManager` names. */
function app(packageManager?: string): Record<string, string> {
	return {
		"package.json": JSON.stringify({ name: "app", packageManager }),
		"bootstrap/cli.ts": "await cli.run(process.argv.slice(2));\n",
	};
}

describe("sdxc run", () => {
	test("hands every token after run to the app's command line under Bun", async () => {
		let root = await project(app("bun@1.3.0"));

		let run = await invoke(createSDXC(), ["run", "users", "find", "--limit", "5", "--help"], {
			cwd: root,
			exec: { "bun bootstrap/cli.ts users find --limit 5 --help": { code: 0 } },
		});

		expect(run.code).toBe(0);
		expect(run.exec).toEqual([
			{
				command: ["bun", "bootstrap/cli.ts", "users", "find", "--limit", "5", "--help"],
				cwd: root,
				stdio: "inherit",
			},
		]);
	});

	test("runs under Node for a project on another package manager", async () => {
		let root = await project(app("pnpm@9.0.0"));

		let run = await invoke(createSDXC(), ["run", "users"], {
			cwd: root,
			exec: { "node bootstrap/cli.ts users": { code: 0 } },
		});

		expect(run.code).toBe(0);
	});

	test("exits with the app's exit code and adds no message of its own", async () => {
		let root = await project(app("bun@1.3.0"));

		let run = await invoke(createSDXC(), ["run", "users", "find"], {
			cwd: root,
			exec: { "bun bootstrap/cli.ts users find": { code: 3 } },
		});

		expect(run.code).toBe(3);
		expect(run.stderr).toBe("");
	});

	test("names the missing file in a project without a command line", async () => {
		let root = await project({ "package.json": JSON.stringify({ name: "app" }) });

		let run = await invoke(createSDXC(), ["run", "users"], { cwd: root });

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("bootstrap/cli.ts not found");
		expect(run.exec).toEqual([]);
	});
});
