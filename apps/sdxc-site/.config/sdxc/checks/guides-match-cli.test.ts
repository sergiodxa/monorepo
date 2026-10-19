/**
 * Tests for the guides check: how command lines are found in a guide, and the report for
 * guides the CLI accepts, refuses, or leaves gaps in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ProjectCheckContext } from "@sdxc/kit/doctor";

import { describe, expect, test } from "vitest";

import check, { findInvocations, sdxcCommands, shellWords } from "./guides-match-cli";

/** A context over an in-memory set of guides. */
function context(guides: Record<string, string>): ProjectCheckContext {
	return {
		root: "/project",
		manifest: {},
		config: {} as ProjectCheckContext["config"],
		routes: [],
		readFile: (path) => Promise.resolve(guides[path] ?? null),
		exists: (path) => Promise.resolve(path in guides),
		files: (folder) =>
			Promise.resolve(Object.keys(guides).filter((path) => path.startsWith(`${folder}/`))),
	};
}

describe("shellWords", () => {
	test("honors quotes, escapes and comments", () => {
		expect(shellWords(`sdxc scaffold person 'bio?' "a b" c\\ d # note`)).toEqual([
			"sdxc",
			"scaffold",
			"person",
			"bio?",
			"a b",
			"c d",
		]);
	});
});

describe("sdxcCommands", () => {
	test("finds each sdxc command a line chains, and marks outlines", () => {
		expect(sdxcCommands("$ sdxc create my-app && cd my-app && sdxc make <kind> <name>")).toEqual([
			{ argv: ["create", "my-app"], outline: false },
			{ argv: ["make", "<kind>", "<name>"], outline: true },
		]);
	});
});

describe("findInvocations", () => {
	test("reads shell fences, joined lines and inline code, and skips other fences", () => {
		let text = [
			"Run `sdxc routes -g posts` to narrow it.",
			"```bash",
			"sdxc make job reports \\",
			"  --cron '0 * * * *'",
			"```",
			"```text",
			"sdxc make nothing",
			"```",
		].join("\n");
		expect(findInvocations("guide.md", text)).toEqual([
			{ file: "guide.md", line: 1, inline: true, argv: ["routes", "-g", "posts"], outline: false },
			{
				file: "guide.md",
				line: 3,
				inline: false,
				argv: ["make", "job", "reports", "--cron", "0 * * * *"],
				outline: false,
			},
		]);
	});
});

describe("guides-match-cli", () => {
	test("fails on a line the CLI refuses, naming the guide and line", async () => {
		let report = await check.run(
			context({
				"resources/docs/sdxc/deploy.md": "```bash\nsdxc deploy --force\n```\n",
			}),
		);
		expect(report.status).toBe("fail");
		expect(report.findings?.[0]).toMatch(
			/^resources\/docs\/sdxc\/deploy\.md:2 sdxc deploy --force — .*--force/,
		);
	});

	test("accepts a command named without its argument in prose", async () => {
		let report = await check.run(
			context({ "resources/docs/sdxc/ui.md": "Run `sdxc ui diff` to compare.\n" }),
		);
		expect(report.status).not.toBe("fail");
	});

	test("warns on commands and flags no guide shows", async () => {
		let report = await check.run(
			context({ "resources/docs/sdxc/deploy.md": "```bash\nsdxc deploy --dry-run\n```\n" }),
		);
		expect(report.status).toBe("warn");
		expect(report.findings).toContain("sdxc deploy --yes: no guide that runs it mentions it");
		expect(report.findings).toContain("sdxc init: no guide in resources/docs/sdxc/ runs it");
	});
});
