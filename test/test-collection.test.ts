/**
 * Repo-wide guard that every test file is actually collected by a Vitest project.
 *
 * A file matched by no project's `include` is never seen and never reported as
 * skipped, so omitting a project entry deletes coverage without failing anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import config from "../vite.config";

import { findUncollectablePackageTests, findUnregisteredApps } from "./test-collection";

/**
 * Repo root, resolved from this file so the scan always targets the same
 * location no matter where the process runs from.
 */
const ROOT = join(import.meta.dirname, "..");

/** The shape this file reads out of the config; `defineConfig`'s type is wider than this. */
interface ProjectEntry {
	root?: string;
	test?: { name?: string };
}

/** Every `root` declared by a project, which for an app project is its directory. */
function projectRoots(): string[] {
	let projects = (config as unknown as { test: { projects: ProjectEntry[] } }).test.projects;
	return projects
		.map((project) => project.root)
		.filter((root): root is string => root !== undefined);
}

/** Repo-relative paths of every test file under `area`, ignoring installed dependencies. */
function testFilesUnder(area: string): string[] {
	return globSync("**/*.test.{ts,tsx}", { cwd: join(ROOT, area) })
		.map((file) => `${area}/${file}`)
		.filter((path) => !path.includes("/node_modules/"));
}

/** The `apps/<name>` directories that ship at least one test file. */
function appsWithTests(): string[] {
	return [...new Set(testFilesUnder("apps").map((path) => path.split("/").slice(0, 2).join("/")))];
}

describe("every test file is collected by a project", () => {
	describe("the scanners themselves", () => {
		test("an app with tests and no project root is reported", () => {
			expect(findUnregisteredApps(["apps/one", "apps/two"], ["apps/one"])).toEqual(["apps/two"]);
		});

		test("an app with a project root is not reported, and the result is sorted", () => {
			expect(findUnregisteredApps(["apps/b", "apps/a"], ["apps/a", "apps/b"])).toEqual([]);
			expect(findUnregisteredApps(["apps/b", "apps/a"], [])).toEqual(["apps/a", "apps/b"]);
		});

		test("a package test outside src/ is reported, inside src/ is not", () => {
			expect(findUncollectablePackageTests(["packages/one/test/a.test.ts"])).toEqual([
				"packages/one/test/a.test.ts",
			]);
			expect(findUncollectablePackageTests(["packages/one/src/a.test.ts"])).toEqual([]);
			expect(findUncollectablePackageTests(["packages/one/src/deep/a.test.tsx"])).toEqual([]);
		});
	});

	test("every app that ships tests has a Vitest project rooted at it", () => {
		let apps = appsWithTests();

		expect(apps.length).toBeGreaterThan(5);
		expect(
			findUnregisteredApps(apps, projectRoots()),
			"add an entry to `test.projects` in the root vite.config.ts, then verify with `vp test run --project <name>`",
		).toEqual([]);
	});

	test("every package test file sits under the package's src/, where the glob looks", () => {
		let files = testFilesUnder("packages");

		expect(files.length).toBeGreaterThan(100);
		expect(
			findUncollectablePackageTests(files),
			"move the test under the package's src/, or it is collected by no project",
		).toEqual([]);
	});
});
