/**
 * Project root detection and the boundary every configured path is held to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { findProjectRoot, resolveInside } from "./project.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A fresh temporary directory. */
async function temporary(): Promise<string> {
	let dir = await mkdtemp(join(tmpdir(), "sdxc-project-"));
	DIRECTORIES.push(dir);
	return dir;
}

describe("findProjectRoot", () => {
	test("answers the nearest directory at or above cwd holding a package.json", async () => {
		let root = await temporary();
		await writeFile(join(root, "package.json"), "{}");
		await mkdir(join(root, "packages/app/src"), { recursive: true });
		await writeFile(join(root, "packages/app/package.json"), "{}");

		expect(unwrap(await findProjectRoot(join(root, "packages/app/src")))).toBe(
			join(root, "packages/app"),
		);
		expect(unwrap(await findProjectRoot(root))).toBe(root);
	});

	test("skips a directory named package.json", async () => {
		let root = await temporary();
		await writeFile(join(root, "package.json"), "{}");
		await mkdir(join(root, "nested/package.json"), { recursive: true });

		expect(unwrap(await findProjectRoot(join(root, "nested")))).toBe(root);
	});
});

describe("resolveInside", () => {
	test("resolves a relative path inside the root", () => {
		expect(unwrap(resolveInside("/project", "resources/components/ui"))).toBe(
			"/project/resources/components/ui",
		);
		expect(unwrap(resolveInside("/project", "a/../b"))).toBe("/project/b");
	});

	test("refuses an absolute path and one that climbs out of the root", () => {
		let absolute = resolveInside("/project", "/etc/sdxc");
		let climbing = resolveInside("/project", "../elsewhere");

		expect(isFailure(absolute) && absolute.error.message).toBe(
			"/etc/sdxc must be relative to the project root",
		);
		expect(isFailure(climbing) && climbing.error.message).toBe(
			"../elsewhere points outside the project root",
		);
	});
});
