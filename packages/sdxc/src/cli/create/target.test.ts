/**
 * Target resolution for `sdxc create`: which directories can take a project and the
 * package name each one gives it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { packageName, resolveTarget } from "./target.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A fresh temporary directory. */
async function temporary(): Promise<string> {
	let dir = await mkdtemp(join(tmpdir(), "sdxc-target-"));
	DIRECTORIES.push(dir);
	return dir;
}

describe("resolveTarget", () => {
	test("accepts a missing directory, named after its last segment", async () => {
		let cwd = await temporary();

		let target = unwrap(await resolveTarget(cwd, "apps/My Blog"));

		expect(target).toEqual({
			directory: join(cwd, "apps/My Blog"),
			name: "my-blog",
			exists: false,
			hasGit: false,
		});
	});

	test("accepts the current directory when it is empty or holds only .git", async () => {
		let cwd = await temporary();
		let empty = unwrap(await resolveTarget(join(cwd), undefined));
		await mkdir(join(cwd, ".git"));

		let withGit = unwrap(await resolveTarget(cwd, undefined));

		expect(empty).toMatchObject({ directory: cwd, exists: true, hasGit: false });
		expect(withGit).toMatchObject({ directory: cwd, exists: true, hasGit: true });
	});

	test("refuses a directory with anything else in it, naming what is there", async () => {
		let cwd = await temporary();
		await writeFile(join(cwd, "README.md"), "");
		await mkdir(join(cwd, ".git"));

		let target = await resolveTarget(cwd, ".");

		expect(isFailure(target) && target.error.message).toBe(
			`${cwd} is not empty (README.md); sdxc create needs an empty directory`,
		);
	});

	test("refuses a file", async () => {
		let cwd = await temporary();
		await writeFile(join(cwd, "app"), "");

		let target = await resolveTarget(cwd, "app");

		expect(isFailure(target) && target.error.message).toBe(
			`${join(cwd, "app")} is a file; sdxc create needs an empty directory`,
		);
	});
});

describe("packageName", () => {
	test("lowercases and collapses characters npm refuses", () => {
		expect(packageName("My App!")).toBe("my-app");
		expect(packageName("blog.v2")).toBe("blog.v2");
		expect(packageName("_private")).toBe("private");
		expect(packageName("???")).toBe("app");
	});
});
