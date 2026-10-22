/**
 * `listApps` answers every Worker app directory that holds a `package.json`, sorted, so doctor
 * and later fan-out commands share one inventory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { listApps } from "./apps.js";

/** Fixture roots created by the current test, removed after it. */
const ROOTS: string[] = [];

afterEach(async () => {
	let created = ROOTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A fake monorepo root with the given app directories (and optional empty dirs). */
async function repo(apps: string[], empty: string[] = []): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "monorepo-apps-"));
	ROOTS.push(root);
	await mkdir(join(root, "apps"), { recursive: true });
	for (let name of apps) {
		await mkdir(join(root, "apps", name), { recursive: true });
		await writeFile(join(root, "apps", name, "package.json"), "{}");
	}
	for (let name of empty) {
		await mkdir(join(root, "apps", name), { recursive: true });
	}
	return root;
}

describe("listApps", () => {
	test("lists apps with a package.json in name order and skips directories without one", async () => {
		let root = await repo(["uptime", "blog"], ["scratch"]);

		expect(listApps(root)).toEqual(["apps/blog", "apps/uptime"]);
	});
});
