/**
 * Parsing the release's `git log` records and attributing each commit to the packages whose
 * shipped inputs it touched, with inline records so the fixtures never depend on real history.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, isFailure, success, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Commit } from "./commits.js";

import {
	attributeCommits,
	attributeCorrections,
	isMissingBody,
	messageBody,
	parseCommits,
} from "./commits.js";
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
	return {
		sha,
		type: "feat",
		scope: null,
		breaking: false,
		title: sha,
		body: "",
		files,
		corrects: null,
	};
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

		expect(unwrap(parseCommits(log))).toEqual([
			{
				sha: "a".repeat(40),
				type: "feat",
				scope: "jwt",
				breaking: true,
				title: "add ES512 signing keys",
				body: "Adds the P-521 curve.\n\nKeys rotate daily.",
				files: ["packages/jwt/src/jwk.ts", "packages/jwt/src/jwk.test.ts"],
				corrects: null,
			},
			{
				sha: "b".repeat(40),
				type: "fix",
				scope: null,
				breaking: false,
				title: "reject tokens whose `exp` already passed",
				body: "",
				files: ["packages/jwt/src/jwt.ts"],
				corrects: null,
			},
			{
				sha: "c".repeat(40),
				type: "chore",
				scope: null,
				breaking: false,
				title: "Update README",
				body: "",
				files: ["README.md"],
				corrects: null,
			},
			{
				sha: "d".repeat(40),
				type: "merge",
				scope: null,
				breaking: false,
				title: "styles into main",
				body: "",
				files: [],
				corrects: null,
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

		expect(unwrap(parseCommits(log)).map((entry) => entry.body)).toEqual([
			"",
			"Note: this keeps working.\nSee the ADR for why.",
		]);
	});

	test("returns nothing for an empty log", () => {
		expect(unwrap(parseCommits(""))).toEqual([]);
	});

	test("fails on a record short of its four fields, quoting its start", () => {
		let result = parseCommits(`${RECORD}${"a".repeat(40)}${FIELD}feat: half a record\n`);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toContain("Malformed git log record: ");
			expect(result.error.message).toContain("a".repeat(40));
		}
	});
});

describe("Release-Note-For", () => {
	test("records the corrected sha and keeps the replacement note as the body", () => {
		let log = record(
			"e".repeat(40),
			"docs(jwt): correct the migration note",
			"Import `sign` from `@sdxc/jwt/sign`.\n\nRelease-Note-For: 3f2a91c\nCo-authored-by: A <a@example.com>\n",
			[],
		);

		let [parsed] = unwrap(parseCommits(log));

		expect(parsed?.corrects).toBe("3f2a91c");
		expect(parsed?.body).toBe("Import `sign` from `@sdxc/jwt/sign`.");
	});

	test("attributes an empty correction to the packages of the commit it names", async () => {
		let correction = { ...commit("2", []), corrects: "1" };
		let attributed = unwrap(
			await attributeCorrections([commit("0", []), correction], async (sha) =>
				success(sha === "1" ? ["packages/jwt/src/jwt.ts"] : []),
			),
		);

		expect(
			attributeCommits(attributed, PACKAGES)
				.get("@sdxc/jwt")
				?.map((c) => c.sha),
		).toEqual(["2"]);
	});

	test("fails when the named commit cannot be read", async () => {
		let result = await attributeCorrections([{ ...commit("2", []), corrects: "1" }], async () =>
			failure(new Error("unknown revision")),
		);

		expect(isFailure(result)).toBe(true);
	});
});

describe("messageBody", () => {
	test("drops the subject, trailers and everything below git's scissors line", () => {
		let message = [
			"fix(jwt): reject expired tokens",
			"",
			"Before, an expired token verified.",
			"# kept: a comment inside a fenced example",
			"",
			"Co-authored-by: A <a@example.com>",
			"# ------------------------ >8 ------------------------",
			"# Do not modify or remove the line above.",
			"diff --git a/x b/x",
		].join("\n");

		expect(messageBody(message)).toBe(
			"Before, an expired token verified.\n# kept: a comment inside a fenced example",
		);
	});

	test("is empty for a subject-only message", () => {
		expect(messageBody("chore: sweep")).toBe("");
		expect(messageBody("chore: sweep\n")).toBe("");
	});
});

describe("isMissingBody", () => {
	test("flags an empty body and git's bare revert line", () => {
		expect(isMissingBody("")).toBe(true);
		expect(isMissingBody("  \n")).toBe(true);
		expect(isMissingBody(`This reverts commit ${"a".repeat(40)}.`)).toBe(true);
	});

	test("accepts any written note, a revert that explains itself included", () => {
		expect(isMissingBody("Nothing changes for consumers.")).toBe(false);
		expect(
			isMissingBody(`This reverts commit ${"a".repeat(40)}.\n\nConsumers get the old parser back.`),
		).toBe(false);
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
