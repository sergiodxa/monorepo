/**
 * Builds two real packages into a staging directory and loads the result under Node, the one
 * check that proves emitted specifiers, declaration files and the rewritten manifest agree.
 * The staging directory lives under the OS temp dir and is removed afterwards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFile } from "node:child_process";
import { existsSync, globSync } from "node:fs";
import { mkdir, readFile, rm, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { Package, PackageManifest } from "./workspace.js";

import { assertDistSpecifiers, buildPackage, createStagingRoot } from "./build.js";
import { publishManifest } from "./manifest.js";
import { readPackages } from "./workspace.js";

const ROOT = join(import.meta.dirname, "../..");
const execFileAsync = promisify(execFile);
const VERSION = "0.0.0-test.1";
const REPOSITORY_URL = "git+https://github.com/sergiodxa/monorepo.git";
const GIT_HEAD = "0".repeat(40);

let stagingRoot = "";
let typesDir = "";
let resultDir = "";

function packageNamed(packages: Package[], name: string): Package {
	let pkg = packages.find((candidate) => candidate.name === name);
	if (!pkg) throw new Error(`${name} is not under packages/`);
	return pkg;
}

/** Stages `pkg` exactly as a release would, with the given internal pins. */
async function stage(pkg: Package, pins: Record<string, string>, stagingDir: string) {
	let manifest = publishManifest(pkg, {
		version: VERSION,
		pins,
		gitHead: GIT_HEAD,
		repository: { url: REPOSITORY_URL, directory: `packages/${pkg.dir}` },
	});
	await buildPackage(pkg, ROOT, stagingDir, manifest);
}

async function stagedManifest(stagingDir: string): Promise<PackageManifest> {
	return JSON.parse(await readFile(join(stagingDir, "package.json"), "utf8")) as PackageManifest;
}

beforeAll(async () => {
	stagingRoot = await createStagingRoot();
	typesDir = join(stagingRoot, "types");
	resultDir = join(stagingRoot, "result");
	let packages = await readPackages(ROOT);
	await stage(packageNamed(packages, "@sdxc/types"), {}, typesDir);
	await stage(packageNamed(packages, "@sdxc/result"), { "@sdxc/types": VERSION }, resultDir);
}, 120_000);

afterAll(async () => {
	if (stagingRoot !== "") await rm(stagingRoot, { recursive: true, force: true });
});

describe("buildPackage", () => {
	test("emits JavaScript and declarations for the entry point of both packages", () => {
		for (let dir of [typesDir, resultDir]) {
			expect(existsSync(join(dir, "dist/index.js"))).toBe(true);
			expect(existsSync(join(dir, "dist/index.d.ts"))).toBe(true);
		}
	});

	test("leaves every test file out of dist", () => {
		expect(globSync("**/*.test.*", { cwd: join(resultDir, "dist") })).toEqual([]);
		expect(globSync("**/*.js", { cwd: join(resultDir, "dist") }).length).toBeGreaterThan(5);
	});

	test("emits specifiers that stay inside dist", async () => {
		await expect(assertDistSpecifiers(resultDir)).resolves.toBeUndefined();
		await expect(assertDistSpecifiers(typesDir)).resolves.toBeUndefined();
	});

	test("writes a manifest with rewritten exports, exact pins and no workspace ranges", async () => {
		let manifest = await stagedManifest(resultDir);
		let raw = await readFile(join(resultDir, "package.json"), "utf8");

		expect(manifest.exports).toEqual({ ".": "./dist/index.js" });
		expect(manifest.version).toBe(VERSION);
		expect(manifest.dependencies).toEqual({ "@sdxc/types": VERSION });
		expect(manifest.publishConfig).toEqual({ access: "public" });
		expect(manifest).not.toHaveProperty("private");
		expect(manifest).not.toHaveProperty("scripts");
		expect(raw).not.toContain("workspace:");
	});

	test("copies the README and the license beside the build", () => {
		expect(existsSync(join(resultDir, "README.md"))).toBe(true);
		expect(existsSync(join(resultDir, "LICENSE.md"))).toBe(true);
	});

	test("loads under Node once its internal dependency is linked", async () => {
		let link = join(resultDir, "node_modules/@sdxc/types");
		await mkdir(dirname(link), { recursive: true });
		await symlink(typesDir, link, "dir");

		await expect(
			execFileAsync(process.execPath, [
				"--input-type=module",
				"-e",
				"await import(process.argv[1])",
				"--",
				join(resultDir, "dist/index.js"),
			]),
		).resolves.toBeDefined();
	}, 30_000);
});
