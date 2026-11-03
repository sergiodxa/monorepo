/**
 * Release-notes rendering against the exact format the GitHub Release shows: one section per
 * package in alphabetical order, commits oldest first with their bodies indented, and the
 * one-line explanations for republished and first-time packages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Commit } from "./commits.js";
import type { DependencyNode } from "./workspace.js";

import { parseCommits } from "./commits.js";
import { renderNotes } from "./notes.js";

const REPO_URL = "https://github.com/sergiodxa/monorepo";

/** `%x1e` and `%x1f`, the bytes the log format separates records and fields with. */
const RECORD = String.fromCharCode(0x1e);
const FIELD = String.fromCharCode(0x1f);

/** A public graph node named `@sdxc/<name>`. */
function node(name: string, dependencies: string[] = []): DependencyNode {
	return {
		name: `@sdxc/${name}`,
		isPrivate: false,
		dependencies: dependencies.map((dependency) => `@sdxc/${dependency}`),
	};
}

const PACKAGES = [
	node("jwt"),
	node("sample"),
	node("spec", ["sample", "jwt"]),
	node("xml"),
	node("dates"),
];

/** A conventional commit with every field defaulted, so a test names only what it asserts. */
function commit(overrides: Partial<Commit>): Commit {
	return {
		sha: "0".repeat(40),
		type: "feat",
		scope: null,
		breaking: false,
		title: "add something",
		body: "",
		files: [],
		corrects: null,
		...overrides,
	};
}

describe("renderNotes", () => {
	test("renders sections alphabetically with commits, a republish reason and a first release", () => {
		let notes = renderNotes({
			version: "2026.9.3",
			previousTag: "v2026.9.2",
			members: [
				{ name: "@sdxc/xml", reason: "new" },
				{ name: "@sdxc/spec", reason: "dependency" },
				{ name: "@sdxc/jwt", reason: "changed" },
			],
			commitsByPackage: new Map([
				[
					"@sdxc/jwt",
					[
						commit({
							title: "add ES512 signing keys",
							body: "Body paragraphs of the commit, indented with a tab.",
						}),
						commit({ type: "fix", title: "reject tokens whose `exp` already passed" }),
					],
				],
			]),
			packages: PACKAGES,
			repoUrl: REPO_URL,
		});

		expect(notes).toBe(
			[
				"## @sdxc/jwt",
				"- Add ES512 signing keys",
				"\tBody paragraphs of the commit, indented with a tab.",
				"- Reject tokens whose `exp` already passed",
				"",
				"## @sdxc/spec",
				"Republished because `@sdxc/jwt` changed.",
				"",
				"## @sdxc/xml",
				"First release.",
				"",
				"Compare: https://github.com/sergiodxa/monorepo/compare/v2026.9.2...v2026.9.3",
				"",
			].join("\n"),
		);
	});

	test("omits the compare footer on the first release ever", () => {
		let notes = renderNotes({
			version: "2026.9.3",
			previousTag: null,
			members: [{ name: "@sdxc/xml", reason: "new" }],
			commitsByPackage: new Map(),
			packages: PACKAGES,
			repoUrl: REPO_URL,
		});

		expect(notes).toBe("## @sdxc/xml\nFirst release.\n");
	});

	test("marks breaking commits and keeps blank lines inside a body as empty lines", () => {
		let notes = renderNotes({
			version: "2026.9.3",
			previousTag: null,
			members: [{ name: "@sdxc/jwt", reason: "changed" }],
			commitsByPackage: new Map([
				[
					"@sdxc/jwt",
					[
						commit({
							breaking: true,
							title: "drop HS256",
							body: "First paragraph.\n\nSecond paragraph.",
						}),
					],
				],
			]),
			packages: PACKAGES,
			repoUrl: REPO_URL,
		});

		expect(notes).toBe(
			[
				"## @sdxc/jwt",
				"- **Breaking:** Drop HS256",
				"\tFirst paragraph.",
				"",
				"\tSecond paragraph.",
				"",
			].join("\n"),
		);
	});

	test("names the alphabetically first changed dependency of a republished package", () => {
		let notes = renderNotes({
			version: "2026.9.3",
			previousTag: null,
			members: [
				{ name: "@sdxc/spec", reason: "dependency" },
				{ name: "@sdxc/sample", reason: "changed" },
				{ name: "@sdxc/jwt", reason: "changed" },
			],
			commitsByPackage: new Map(),
			packages: PACKAGES,
			repoUrl: REPO_URL,
		});

		expect(notes).toContain("## @sdxc/spec\nRepublished because `@sdxc/jwt` changed.");
	});

	test("lists a new package's commits and says Republished for a changed one without any", () => {
		let notes = renderNotes({
			version: "2026.9.3",
			previousTag: null,
			members: [
				{ name: "@sdxc/xml", reason: "new" },
				{ name: "@sdxc/dates", reason: "changed" },
			],
			commitsByPackage: new Map([["@sdxc/xml", [commit({ title: "add the writer" })]]]),
			packages: PACKAGES,
			repoUrl: REPO_URL,
		});

		expect(notes).toBe(
			["## @sdxc/dates", "Republished.", "", "## @sdxc/xml", "- Add the writer", ""].join("\n"),
		);
	});

	test("lists a package's breaking commits before its other commits", () => {
		let notes = renderNotes({
			version: "2026.9.3",
			previousTag: null,
			members: [{ name: "@sdxc/jwt", reason: "changed" }],
			commitsByPackage: new Map([
				[
					"@sdxc/jwt",
					[
						commit({ type: "fix", title: "Reject expired tokens" }),
						commit({ breaking: true, title: "Drop HS256" }),
						commit({ title: "Add ES512 signing keys" }),
					],
				],
			]),
			packages: PACKAGES,
			repoUrl: REPO_URL,
		});

		expect(notes).toBe(
			[
				"## @sdxc/jwt",
				"- **Breaking:** Drop HS256",
				"- Reject expired tokens",
				"- Add ES512 signing keys",
				"",
			].join("\n"),
		);
	});

	test("carries no trailer from a parsed commit into the notes", () => {
		let sha = "a".repeat(40);
		let body = "Adds keys.\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n";
		let log = `${RECORD}${sha}${FIELD}feat(jwt): add keys${FIELD}${body}${FIELD}\n\npackages/jwt/src/jwk.ts\n`;
		let notes = renderNotes({
			version: "2026.9.3",
			previousTag: null,
			members: [{ name: "@sdxc/jwt", reason: "changed" }],
			commitsByPackage: new Map([["@sdxc/jwt", unwrap(parseCommits(log))]]),
			packages: PACKAGES,
			repoUrl: REPO_URL,
		});

		expect(notes).toBe("## @sdxc/jwt\n- Add keys\n\tAdds keys.\n");
		expect(notes).not.toContain("Co-Authored-By");
	});

	test("shortens the largest section to linked titles until the notes fit", () => {
		let input = {
			version: "2026.9.3",
			previousTag: null,
			members: [
				{ name: "@sdxc/jwt", reason: "changed" as const },
				{ name: "@sdxc/xml", reason: "changed" as const },
			],
			commitsByPackage: new Map([
				[
					"@sdxc/jwt",
					[commit({ sha: "b".repeat(40), title: "add keys", body: "Long note. ".repeat(20) })],
				],
				["@sdxc/xml", [commit({ title: "add the writer", body: "Short note." })]],
			]),
			packages: PACKAGES,
			repoUrl: REPO_URL,
		};
		let full = renderNotes(input);
		let notes = renderNotes({ ...input, maxLength: full.length - 1 });

		expect(notes).toBe(
			[
				"## @sdxc/jwt",
				"Shortened to fit the release page; each change links to its full note.",
				`- Add keys ([bbbbbbb](${REPO_URL}/commit/${"b".repeat(40)}))`,
				"",
				"## @sdxc/xml",
				"- Add the writer",
				"\tShort note.",
				"",
			].join("\n"),
		);
	});

	test("renders every section shortened when even that exceeds the limit", () => {
		let notes = renderNotes({
			version: "2026.9.3",
			previousTag: null,
			members: [
				{ name: "@sdxc/jwt", reason: "changed" },
				{ name: "@sdxc/spec", reason: "dependency" },
			],
			commitsByPackage: new Map([["@sdxc/jwt", [commit({ title: "add keys", body: "Note." })]]]),
			packages: PACKAGES,
			repoUrl: REPO_URL,
			maxLength: 1,
		});

		expect(notes).toContain("- Add keys ([0000000]");
		expect(notes).toContain("## @sdxc/spec\nRepublished because `@sdxc/jwt` changed.");
	});
});
