/**
 * Parsing the release's `git log` records and attributing each commit to the packages whose
 * shipped inputs it touched, with inline records so the fixtures never depend on real history.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Commit } from "./commits.js";

import { attributeCommits, parseCommits } from "./commits.js";
import { packageFromManifest } from "./workspace.js";

/** `%x1e`, the byte the log format starts every record with. */
const RECORD = String.fromCharCode(0x1e);

/** `%x1f`, the byte between the sha, subject, body and file list of a record. */
const FIELD = String.fromCharCode(0x1f);

/** One record exactly as `git log --format=%x1e%H%x1f%s%x1f%b%x1f --name-only` prints it. */
function record(sha: string, subject: string, body: string, files: string[]): string {
	let fileList = files.length > 0 ? `\n${files.join("\n")}\n` : "";
	return `${RECORD}${sha}${FIELD}${subject}${FIELD}${body}${FIELD}\n${fileList}`;
}

/** A commit whose only interesting property is the files it touched. */
function commit(sha: string, files: string[]): Commit {
	return { sha, type: "feat", scope: null, breaking: false, title: sha, body: "", files };
}

const JWT = packageFromManifest("jwt", {
	name: "@sdxc/jwt",
	exports: { ".": "./src/index.ts" },
});
const HIGHLIGHT = packageFromManifest("highlight", {
	name: "@sdxc/highlight",
	exports: { ".": "./src/index.ts", "./styles.css": "./styles.css" },
});
const INTERNAL = packageFromManifest("internal", {
	name: "@sdxc/internal",
	private: true,
	exports: { ".": "./src/index.ts" },
});
const PACKAGES = [JWT, HIGHLIGHT, INTERNAL];

describe("parseCommits", () => {
	test("splits records into typed commits with their files", () => {
		let log = [
			record(
				"a".repeat(40),
				"feat(jwt)!: add ES512 signing keys",
				"Adds the P-521 curve.\n\nKeys rotate daily.\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nSigned-off-by: Sergio <sergio@example.com>\n",
				["packages/jwt/src/jwk.ts", "packages/jwt/src/jwk.test.ts"],
			),
			record("b".repeat(40), "fix: reject tokens whose `exp` already passed", "", [
				"packages/jwt/src/jwt.ts",
			]),
			record("c".repeat(40), "Update README", "", ["README.md"]),
			record("d".repeat(40), "merge: styles into main", "", []),
		].join("");

		expect(parseCommits(log)).toEqual([
			{
				sha: "a".repeat(40),
				type: "feat",
				scope: "jwt",
				breaking: true,
				title: "add ES512 signing keys",
				body: "Adds the P-521 curve.\n\nKeys rotate daily.",
				files: ["packages/jwt/src/jwk.ts", "packages/jwt/src/jwk.test.ts"],
			},
			{
				sha: "b".repeat(40),
				type: "fix",
				scope: null,
				breaking: false,
				title: "reject tokens whose `exp` already passed",
				body: "",
				files: ["packages/jwt/src/jwt.ts"],
			},
			{
				sha: "c".repeat(40),
				type: "chore",
				scope: null,
				breaking: false,
				title: "Update README",
				body: "",
				files: ["README.md"],
			},
			{
				sha: "d".repeat(40),
				type: "merge",
				scope: null,
				breaking: false,
				title: "styles into main",
				body: "",
				files: [],
			},
		]);
	});

	test("drops a body made only of trailers and keeps prose that merely resembles one", () => {
		let log = [
			record(
				"a".repeat(40),
				"chore: sweep",
				"Co-Authored-By: Claude <noreply@anthropic.com>\n",
				[],
			),
			record(
				"b".repeat(40),
				"chore: sweep",
				"Note: this keeps working.\nSee the ADR for why.\n",
				[],
			),
		].join("");

		expect(parseCommits(log).map((entry) => entry.body)).toEqual([
			"",
			"Note: this keeps working.\nSee the ADR for why.",
		]);
	});

	test("returns nothing for an empty log", () => {
		expect(parseCommits("")).toEqual([]);
	});
});

describe("attributeCommits", () => {
	test("ignores test files, so a test-only commit touches nothing", () => {
		let commits = [
			commit("1", ["packages/jwt/src/jwk.test.ts", "packages/jwt/src/jwk.workers.test.tsx"]),
		];

		expect(attributeCommits(commits, PACKAGES).size).toBe(0);
	});

	test("attributes a root tsconfig change to every public package", () => {
		let byPackage = attributeCommits([commit("1", ["tsconfig.json"])], PACKAGES);

		expect([...byPackage.keys()].sort()).toEqual(["@sdxc/highlight", "@sdxc/jwt"]);
	});

	test("attributes an apps-only commit to nothing", () => {
		let commits = [commit("1", ["apps/blog/src/index.ts", "apps/blog/package.json"])];

		expect(attributeCommits(commits, PACKAGES).size).toBe(0);
	});

	test("lists one commit under every package it touches", () => {
		let shared = commit("1", ["packages/jwt/src/jwt.ts", "packages/highlight/README.md"]);
		let byPackage = attributeCommits([shared], PACKAGES);

		expect(byPackage.get("@sdxc/jwt")).toEqual([shared]);
		expect(byPackage.get("@sdxc/highlight")).toEqual([shared]);
	});

	test("counts the manifest, license and non-TypeScript export targets as shipped", () => {
		let commits = [
			commit("1", ["packages/jwt/package.json"]),
			commit("2", ["packages/jwt/LICENSE.md"]),
			commit("3", ["packages/highlight/styles.css"]),
			commit("4", ["packages/jwt/docs/guide.md"]),
		];
		let byPackage = attributeCommits(commits, PACKAGES);

		expect(byPackage.get("@sdxc/jwt")?.map((entry) => entry.sha)).toEqual(["1", "2"]);
		expect(byPackage.get("@sdxc/highlight")?.map((entry) => entry.sha)).toEqual(["3"]);
	});

	test("keeps the given order and attributes private packages too", () => {
		let commits = [
			commit("1", ["packages/internal/src/index.ts"]),
			commit("2", ["packages/jwt/src/a.ts"]),
			commit("3", ["packages/jwt/src/b.ts"]),
		];
		let byPackage = attributeCommits(commits, PACKAGES);

		expect(byPackage.get("@sdxc/jwt")?.map((entry) => entry.sha)).toEqual(["2", "3"]);
		expect(byPackage.get("@sdxc/internal")?.map((entry) => entry.sha)).toEqual(["1"]);
	});
});
