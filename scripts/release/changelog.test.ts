/**
 * `buildChangelog`: the line per commit, package and release, corrections folded into the
 * line they replace, and the twelve-month window that keeps only breaking entries before it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import type { ReleaseCommits } from "./changelog.js";
import type { Commit } from "./commits.js";

import { buildChangelog } from "./changelog.js";

/** A commit with a body, the fields the changelog copies. */
function commit(sha: string, overrides: Partial<Commit> = {}): Commit {
	return {
		sha,
		type: "feat",
		scope: null,
		breaking: false,
		title: `title ${sha}`,
		body: `body ${sha}`,
		files: [],
		corrects: null,
		...overrides,
	};
}

/** A release shipping the given commits under each package. */
function release(version: string, byPackage: Record<string, Commit[]>): ReleaseCommits {
	return { version, commitsByPackage: new Map(Object.entries(byPackage)) };
}

describe("buildChangelog", () => {
	test("writes one entry per commit, package and release, oldest release first", () => {
		let shared = commit("aaa1111");
		let entries = buildChangelog(
			[
				release("2026.10.2", { "@sdxc/jwt": [commit("bbb2222", { type: "fix" })] }),
				release("2026.10.1", { "@sdxc/markdown": [shared], "@sdxc/jwt": [shared] }),
			],
			"2026.10.2",
		);
		expect(entries).toEqual([
			{
				release: "2026.10.1",
				package: "@sdxc/jwt",
				type: "feat",
				breaking: false,
				title: "Title aaa1111",
				body: "body aaa1111",
			},
			{
				release: "2026.10.1",
				package: "@sdxc/markdown",
				type: "feat",
				breaking: false,
				title: "Title aaa1111",
				body: "body aaa1111",
			},
			{
				release: "2026.10.2",
				package: "@sdxc/jwt",
				type: "fix",
				breaking: false,
				title: "Title bbb2222",
				body: "body bbb2222",
			},
		]);
	});

	test("replaces a corrected note with its correction and drops the correction's own line", () => {
		let original = commit("1234567890abcdef");
		let correction = commit("fedcba0987654321", {
			type: "docs",
			body: "the corrected note",
			corrects: "1234567",
		});
		let entries = buildChangelog(
			[
				release("2026.10.1", { "@sdxc/jwt": [original] }),
				release("2026.10.2", { "@sdxc/jwt": [correction] }),
			],
			"2026.10.2",
		);
		expect(entries).toEqual([
			expect.objectContaining({
				release: "2026.10.1",
				title: "Title 1234567890abcdef",
				body: "the corrected note",
			}),
		]);
	});

	test("keeps a correction whose original the history does not hold", () => {
		let correction = commit("fedcba0", { corrects: "0000000" });
		let entries = buildChangelog(
			[release("2026.10.2", { "@sdxc/jwt": [correction] })],
			"2026.10.2",
		);
		expect(entries.map((entry) => entry.title)).toEqual(["Title fedcba0"]);
	});

	test("keeps only breaking entries from releases older than twelve months", () => {
		let entries = buildChangelog(
			[
				release("2025.10.13", {
					"@sdxc/jwt": [commit("old0001"), commit("old0002", { breaking: true })],
				}),
				release("2025.10.14", { "@sdxc/jwt": [commit("edge001")] }),
				release("2026.10.14", { "@sdxc/jwt": [commit("new0001")] }),
			],
			"2026.10.14",
		);
		expect(entries.map((entry) => entry.title)).toEqual([
			"Title old0002",
			"Title edge001",
			"Title new0001",
		]);
	});
});
