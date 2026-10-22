/**
 * The uuid-secrets doctor check: passes sanctioned generators and warns on randomUUID.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { ProjectCheckContext } from "@sdxc/kit/doctor";

import { afterEach, describe, expect, test } from "vitest";

import check from "./uuid-secrets.js";

const ROOTS: string[] = [];

afterEach(async () => {
	let created = ROOTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function context(files: Record<string, string>): Promise<ProjectCheckContext> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-uuid-check-"));
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

describe("uuid-secrets doctor check", () => {
	test("passes generateUUID usage", async () => {
		let ctx = await context({
			"packages/result/src/id.ts":
				'import { generateUUID } from "@sdxc/uuid/v4";\nexport const id = generateUUID();\n',
		});
		expect((await check.run(ctx)).status).toBe("pass");
	});

	test("warns on crypto.randomUUID", async () => {
		let ctx = await context({
			"packages/result/src/id.ts": "export const id = crypto.randomUUID();\n",
		});
		let result = await check.run(ctx);
		expect(result.status).toBe("warn");
		expect(result.findings?.[0]).toContain("randomUUID");
	});
});
