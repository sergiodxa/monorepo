/**
 * Exercises the Workers entry point inside workerd, the runtime it ships to.
 * The import-graph guard in `workers.test.ts` proves no `bun:` specifier is
 * reachable; only running here proves the parsers behind `html` actually load.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Grants } from "./permissions.js";
import type { SuiteResult } from "./workers.js";

import {
	createHtmlPlugin,
	createNoFilesystemWorkspace,
	createSpecPlugin,
	createStrPlugin,
	loadSources,
	runTests,
} from "./workers.js";

/** The markup every `html` case reads, written as one spec string literal. */
const PAGE = JSON.stringify(
	[
		"<!doctype html>",
		"<html><head><title>Status</title></head>",
		'<body><h1>All systems operational</h1><button type="button">Retry</button></body>',
		"</html>",
	].join(""),
);

function noGrants(): Grants {
	return {
		run: { mode: "denied" },
		net: { mode: "denied" },
		env: { mode: "denied" },
		hostFs: { mode: "denied" },
		db: { mode: "denied" },
	};
}

/** Run one spec source under workerd, with the namespaces a hosted run gets. */
async function run(text: string): Promise<SuiteResult> {
	let loaded = loadSources([{ path: "flow.spec", text }]);
	if (isFailure(loaded)) throw new Error(loaded.error.message);
	let result = await runTests({
		suite: loaded.data,
		plugins: [createHtmlPlugin(), createSpecPlugin(), createStrPlugin()],
		grants: noGrants(),
		createWorkspace: createNoFilesystemWorkspace,
	});
	if (isFailure(result)) throw new Error(`Expected the run to start: ${result.error.message}`);
	return result.data;
}

describe("the html namespace on workerd", () => {
	test("parses a document and reads its title", async () => {
		let outcome = await run(
			[
				"use html",
				'test "the page is titled" {',
				"\twhen {",
				`\t\tlet page = ${PAGE}`,
				"\t}",
				"\tthen {",
				'\t\texpect html.title page "Status"',
				"\t}",
				"}",
			].join("\n"),
		);
		expect(outcome.results[0]?.error?.message).toBeUndefined();
		expect(outcome.passed).toBe(1);
	});

	test("computes an accessible name, which is what `html.element` addresses by", async () => {
		let outcome = await run(
			[
				"use html",
				'test "the retry button is there" {',
				"\twhen {",
				`\t\tlet page = ${PAGE}`,
				"\t}",
				"\tthen {",
				'\t\texpect html.element page button "Retry" exists',
				'\t\texpect html.heading page "All systems operational" exists',
				"\t}",
				"}",
			].join("\n"),
		);
		expect(outcome.results[0]?.error?.message).toBeUndefined();
		expect(outcome.passed).toBe(1);
	});

	test("reports a missing element rather than throwing out of the runtime", async () => {
		let outcome = await run(
			[
				"use html",
				'test "a button nobody rendered" {',
				"\twhen {",
				`\t\tlet page = ${PAGE}`,
				"\t}",
				"\tthen {",
				'\t\texpect html.button page "Cancel" exists',
				"\t}",
				"}",
			].join("\n"),
		);
		expect(outcome.failed).toBe(1);
	});
});

describe("the spec and str namespaces on workerd", () => {
	test("read the run's identity and compose it into a generated value", async () => {
		let outcome = await run(
			[
				"use spec",
				"use str",
				'test "the signup address is unique to this attempt" {',
				"\twhen {",
				"\t\tlet nonce = spec.nonce",
				'\t\tlet email = str.format "user-${0}@example.com" nonce',
				'\t\tlet fixed = str.format "user-${0}@example.com" "abc"',
				"\t}",
				"\tthen {",
				"\t\texpect spec.attempt 1",
				'\t\texpect fixed "user-abc@example.com"',
				"\t}",
				"}",
			].join("\n"),
		);
		expect(outcome.results[0]?.error?.message).toBeUndefined();
		expect(outcome.passed).toBe(1);
	});
});
