/**
 * Repo-wide guard that every package without `private: true` is ready to publish: it has a
 * description, README and license, reaches no private package through its dependencies, and
 * has a row in the root README package table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import type { PackageManifest } from "../scripts/release/workspace.js";

import { packageFromManifest } from "../scripts/release/workspace.js";

import type { PackageFacts } from "./public-packages.js";

import { publicPackageProblems, readmeRowProblems } from "./public-packages.js";

/** Repo root, resolved from this file so the scan targets the same tree from any cwd. */
const ROOT = join(import.meta.dirname, "..");

/** A README package table as the root README lays it out. */
const README = [
	"## Packages",
	"",
	"| Package | Description |",
	"| --- | --- |",
	"| [types](packages/types) | Shared TypeScript types |",
	"| [blog](apps/blog) | An app row, which the scanner ignores | https://example.com |",
	"",
].join("\n");

/** A complete public package named `@sdxc/<dir>`, with any fact overridden. */
function facts(dir: string, overrides: Partial<PackageFacts> = {}): PackageFacts {
	return {
		dir,
		name: `@sdxc/${dir}`,
		isPrivate: false,
		hasDescription: true,
		hasReadme: true,
		hasLicense: true,
		dependencies: [],
		...overrides,
	};
}

/** The facts for every `packages/<dir>` that has a manifest, read from disk. */
function repoFacts(): PackageFacts[] {
	let packagesDir = join(ROOT, "packages");
	return readdirSync(packagesDir, { withFileTypes: true })
		.filter(
			(entry) => entry.isDirectory() && existsSync(join(packagesDir, entry.name, "package.json")),
		)
		.map((entry) => {
			let dir = join(packagesDir, entry.name);
			let manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as PackageManifest;
			let pkg = packageFromManifest(entry.name, manifest);
			return {
				dir: entry.name,
				name: pkg.name,
				isPrivate: pkg.isPrivate,
				hasDescription:
					typeof manifest.description === "string" && manifest.description.trim() !== "",
				hasReadme: existsSync(join(dir, "README.md")),
				hasLicense: existsSync(join(dir, "LICENSE.md")),
				dependencies: pkg.dependencies,
			};
		});
}

describe("public packages are ready to publish", () => {
	describe("the scanners themselves", () => {
		test("accepts a complete public package and ignores a private one's gaps", () => {
			let complete = facts("types");
			let internal = facts("internal", {
				isPrivate: true,
				hasDescription: false,
				hasReadme: false,
				hasLicense: false,
			});

			expect(publicPackageProblems([complete, internal])).toEqual([]);
		});

		test("reports each missing description, README and license, sorted", () => {
			let problems = publicPackageProblems([
				facts("spec", { hasLicense: false }),
				facts("result", { hasDescription: false, hasReadme: false }),
			]);

			expect(problems).toEqual([
				"@sdxc/result is public but has no README.md",
				"@sdxc/result is public but has no description",
				"@sdxc/spec is public but has no LICENSE.md",
			]);
		});

		test("reports every private package a public one reaches, naming the chain", () => {
			let problems = publicPackageProblems([
				facts("spec", { dependencies: ["@sdxc/sample"] }),
				facts("sample", { dependencies: ["@sdxc/foo"] }),
				facts("foo", { isPrivate: true }),
			]);

			expect(problems).toEqual([
				"@sdxc/sample depends on private @sdxc/foo",
				"@sdxc/spec depends on private @sdxc/foo (via @sdxc/sample)",
			]);
		});

		test("accepts a README listing every public package and ignores private ones", () => {
			let all = [facts("types"), facts("internal", { isPrivate: true })];

			expect(readmeRowProblems(README, all)).toEqual([]);
		});

		test("reports a public package with no row at all", () => {
			let all = [facts("types"), facts("xml")];

			expect(readmeRowProblems(README, all)).toEqual([
				"@sdxc/xml is public but has no row in the README package table",
			]);
		});
	});

	test("every public package has its metadata and reaches no private package", () => {
		let all = repoFacts();

		expect(all.length).toBeGreaterThan(40);
		expect(
			publicPackageProblems(all),
			"add the missing file or field, or open the private package the public one depends on",
		).toEqual([]);
	});

	test("the README package table lists every public package", () => {
		let readme = readFileSync(join(ROOT, "README.md"), "utf8");

		expect(
			readmeRowProblems(readme, repoFacts()),
			"add a row for the package to the root README package table",
		).toEqual([]);
	});
});
