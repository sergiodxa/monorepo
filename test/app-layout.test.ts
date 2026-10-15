/**
 * Repo-wide guard that every converted app keeps the shared folder layout: a closed list of
 * folders at its root and under `app/`, entry points alone in `bootstrap/`, and no module
 * importing an entry point. A misplaced file fails here instead of starting a second home.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	APP_FOLDERS,
	APP_ROOT_FOLDERS,
	CONVERTED_APPS,
	importSpecifiers,
	isBootstrapEntry,
	isIgnoredRootFolder,
	reachesBootstrap,
} from "./app-layout";

/** Repo root, resolved from this file so the scan targets the same tree from any cwd. */
const ROOT = join(import.meta.dirname, "..");

/** The names of the folders directly inside `path`. */
function foldersIn(path: string): string[] {
	return readdirSync(path, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

describe("the scanner itself", () => {
	test("finds static, dynamic and side-effect specifiers", () => {
		let source = [
			'import a from "./a";',
			'import type { B } from "~/b";',
			'let c = await import("../c");',
			'import "./d";',
		].join("\n");

		expect(unwrap(importSpecifiers("a.ts", source))).toEqual(["./a", "~/b", "../c", "./d"]);
	});

	test("treats the alias and relative paths into bootstrap as entry-point imports", () => {
		expect(reachesBootstrap("~/bootstrap/worker", "app/models/a.ts")).toBe(true);
		expect(reachesBootstrap("../../bootstrap/worker", "app/models/a.ts")).toBe(true);
		expect(reachesBootstrap("./worker", "bootstrap/browser.ts")).toBe(true);
		expect(reachesBootstrap("~/app/initializers/router", "bootstrap/worker.ts")).toBe(false);
		expect(reachesBootstrap("../initializers/router", "app/http/render.tsx")).toBe(false);
	});

	test("allows the entry points and their tests", () => {
		expect(isBootstrapEntry("worker.ts")).toBe(true);
		expect(isBootstrapEntry("worker.workers.test.ts")).toBe(true);
		expect(isBootstrapEntry("do")).toBe(false);
		expect(isBootstrapEntry("app.tsx")).toBe(false);
		expect(isBootstrapEntry("logger.ts")).toBe(false);
	});
});

describe.each(CONVERTED_APPS)("apps/%s", (app) => {
	let appRoot = join(ROOT, "apps", app);

	test("holds only the shared root folders", () => {
		let extra = foldersIn(appRoot).filter(
			(name) => !isIgnoredRootFolder(name) && !APP_ROOT_FOLDERS.has(name),
		);
		expect(extra).toEqual([]);
	});

	test("holds only the shared folders under app/", () => {
		let extra = foldersIn(join(appRoot, "app")).filter((name) => !APP_FOLDERS.has(name));
		expect(extra).toEqual([]);
	});

	test("keeps only entry points in bootstrap/", () => {
		let extra = readdirSync(join(appRoot, "bootstrap")).filter((name) => !isBootstrapEntry(name));
		expect(extra).toEqual([]);
	});

	test("imports no entry point from outside bootstrap/", () => {
		let files = globSync("{app,config,database,resources,routes}/**/*.{ts,tsx}", {
			cwd: appRoot,
		});

		let offenders = files.flatMap((file) => {
			let specifiers = importSpecifiers(file, readFileSync(join(appRoot, file), "utf8"));
			if (isFailure(specifiers)) return [specifiers.error.message];
			return specifiers.data
				.filter((specifier) => reachesBootstrap(specifier, file))
				.map((specifier) => `${file} → ${specifier}`);
		});

		expect(offenders).toEqual([]);
	});
});
