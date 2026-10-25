/**
 * The one package-manager lookup `create` and `upgrade` share: the `packageManager` field over
 * lock files, lock files over the user agent, the nearest directory's lock file winning, and
 * the script command each one spells.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
	lockFileAtOrAbove,
	packageManager,
	projectPackageManager,
	scriptCommand,
} from "./package-manager.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Answers lock files from a fixed list, as a template tree does. */
function holding(...files: string[]) {
	return (names: readonly string[]) => names.find((name) => files.includes(name)) ?? null;
}

describe("packageManager", () => {
	test("takes the packageManager field, then a lock file, then the user agent, then npm", async () => {
		let declared = await packageManager({
			declared: "yarn@4.0.0",
			findLockFile: holding("bun.lock"),
			userAgent: "pnpm/9.0.0",
		});
		let locked = await packageManager({
			declared: undefined,
			findLockFile: holding("pnpm-lock.yaml"),
			userAgent: "bun/1.3.0",
		});
		let agent = await packageManager({
			declared: "deno@2",
			findLockFile: holding(),
			userAgent: "bun/1.3.0 npm/? node/v22",
		});
		let fallback = await packageManager({ declared: undefined, findLockFile: holding() });

		expect([declared.name, locked.name, agent.name, fallback.name]).toEqual([
			"yarn",
			"pnpm",
			"bun",
			"npm",
		]);
		expect(locked.dlx).toEqual(["pnpm", "dlx"]);
	});

	test("the nearest directory holding a lock file decides", async () => {
		let workspace = await mkdtemp(join(tmpdir(), "sdxc-package-manager-"));
		DIRECTORIES.push(workspace);
		let app = join(workspace, "apps/blog");
		await mkdir(app, { recursive: true });
		await writeFile(join(workspace, "bun.lock"), "");
		await writeFile(join(app, "yarn.lock"), "");

		let nested = await packageManager({
			declared: undefined,
			findLockFile: lockFileAtOrAbove(app),
		});
		let parent = await packageManager({
			declared: undefined,
			findLockFile: lockFileAtOrAbove(join(workspace, "apps")),
		});

		expect(nested.name).toBe("yarn");
		expect(parent.name).toBe("bun");
	});

	test("spells a script as each package manager runs it", async () => {
		let npm = await packageManager({ declared: "npm@10", findLockFile: holding() });
		let bun = await packageManager({ declared: "bun@1", findLockFile: holding() });

		expect(scriptCommand(npm, "dev")).toBe("npm run dev");
		expect(scriptCommand(bun, "dev")).toBe("bun dev");
	});
});

describe("projectPackageManager", () => {
	test("reads package.json's packageManager before any lock file", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-project-manager-"));
		DIRECTORIES.push(root);
		await writeFile(join(root, "package.json"), JSON.stringify({ packageManager: "bun@1.3.0" }));
		let declared = await projectPackageManager(root);

		await writeFile(join(root, "package.json"), "{}");
		await writeFile(join(root, "pnpm-lock.yaml"), "");
		let locked = await projectPackageManager(root);

		expect(declared.install).toEqual(["bun", "install"]);
		expect(locked.name).toBe("pnpm");
	});
});
