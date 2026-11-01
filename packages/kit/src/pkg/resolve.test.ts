/**
 * Tests the parts of `sdxc pkg` a run cannot show from one machine: finding Bun on `PATH` under
 * Windows' executable extensions, and the name forms a lookup accepts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { lookupPackage, onPath } from "./resolve.js";

/** Folders created by the current test, removed after it. */
const FOLDERS: string[] = [];

afterEach(async () => {
	let created = FOLDERS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A folder holding an empty file named `name`. */
async function folderWith(name: string): Promise<string> {
	let dir = await mkdtemp(join(tmpdir(), "sdxc-pkg-path-"));
	FOLDERS.push(dir);
	await writeFile(join(dir, name), "");
	return dir;
}

describe("onPath", () => {
	test("finds bun.exe and bun.cmd as bun on Windows", async () => {
		expect(await onPath("bun", await folderWith("bun.exe"), "win32")).toBe(true);
		expect(await onPath("bun", await folderWith("bun.cmd"), "win32")).toBe(true);
	});

	test("reads names as written elsewhere", async () => {
		expect(await onPath("bun", await folderWith("bun"), "darwin")).toBe(true);
		expect(await onPath("bun", await folderWith("bun.exe"), "linux")).toBe(false);
		expect(await onPath("bun", undefined, "linux")).toBe(false);
	});
});

describe("lookupPackage", () => {
	test("accepts the package name, its specifier and its binary name", () => {
		for (let input of ["uuid", "@sdxc/uuid", "sdxc-uuid", "UUID"]) {
			expect(lookupPackage(input)).toEqual({ kind: "command-line", name: "uuid" });
		}
	});
});
