/**
 * The dom-environment doctor check: passes browser-mode tests and fails a test that selects a
 * simulated DOM through its `@vitest-environment` directive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { ProjectCheckContext } from "@sdxc/kit/doctor";

import { afterEach, describe, expect, test } from "vitest";

import check from "./dom-environment.js";

const ROOTS: string[] = [];

afterEach(async () => {
	let created = ROOTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function context(files: Record<string, string>): Promise<ProjectCheckContext> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-dom-environment-check-"));
	ROOTS.push(root);
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	let readFile = async (path: string): Promise<string | null> => {
		try {
			let { readFile: read } = await import("node:fs/promises");
			return await read(join(root, path), "utf8");
		} catch {
			return null;
		}
	};
	return {
		root,
		manifest: {},
		config: {} as ProjectCheckContext["config"],
		routes: [],
		readFile,
		async exists(path) {
			return (await readFile(path)) !== null;
		},
		async files(folder) {
			let { readdir } = await import("node:fs/promises");
			let { relative, sep } = await import("node:path");
			try {
				let entries = await readdir(join(root, folder), {
					recursive: true,
					withFileTypes: true,
				});
				return entries
					.filter((entry) => entry.isFile())
					.map(
						(entry) =>
							`${folder}/${relative(join(root, folder), join(entry.parentPath, entry.name)).split(sep).join("/")}`,
					)
					.sort();
			} catch {
				return [];
			}
		},
	};
}

describe("dom-environment doctor check", () => {
	test("passes a browser test and a plain one", async () => {
		let ctx = await context({
			"packages/ui/src/menu.browser.test.tsx": "import { test } from 'vitest';\n",
			"packages/ui/src/menu.test.ts": "// @vitest-environment node\n",
		});
		expect((await check.run(ctx)).status).toBe("pass");
	});

	test.each(["happy-dom", "jsdom"])("fails a test file asking for %s", async (environment) => {
		let ctx = await context({
			"apps/blog/resources/components/menu.test.tsx": `// @vitest-environment ${environment}\n`,
		});
		let result = await check.run(ctx);
		expect(result.status).toBe("fail");
		expect(result.findings).toEqual([
			`apps/blog/resources/components/menu.test.tsx:1: // @vitest-environment ${environment}`,
		]);
	});

	test("ignores source that only names the directive, and installed code", async () => {
		let ctx = await context({
			"packages/kit/src/doctor/jsdoc.ts": "// @vitest-environment happy-dom\n",
			"apps/blog/node_modules/x/a.test.ts": "// @vitest-environment happy-dom\n",
		});
		expect((await check.run(ctx)).status).toBe("pass");
	});
});
