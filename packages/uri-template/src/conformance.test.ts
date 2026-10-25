/**
 * Runs the uritemplate-test suite: every spec example, extended test and negative test.
 * A case lists one expected expansion, several acceptable ones (where object member order
 * is open), or `false` for a template or value that must fail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Variables } from "./expand.js";

import { expand } from "./uri-template.js";

/** One group of the suite, sharing its variables. */
interface SuiteGroup {
	variables: Variables;
	testcases: [string, string | string[] | false][];
}

/** The suite files, each a map of group name to group. */
const FILES = [
	"spec-examples.json",
	"spec-examples-by-section.json",
	"extended-tests.json",
	"negative-tests.json",
];

/** Every case, labelled with its file and group. */
const CASES = FILES.flatMap((file) =>
	Object.entries(
		JSON.parse(
			readFileSync(join(import.meta.dirname, "fixtures/uritemplate-test", file), "utf8"),
		) as Record<string, SuiteGroup>,
	).flatMap(([group, { variables, testcases }]) =>
		testcases.map(([template, expected]) => ({
			label: `${file} ${group}: ${template}`,
			template,
			variables,
			expected,
		})),
	),
);

describe("uritemplate-test", () => {
	test.each(CASES)("$label", ({ template, variables, expected }) => {
		let result = expand(template, variables);
		if (expected === false) {
			expect(isFailure(result)).toBe(true);
			return;
		}
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(typeof expected === "string" ? [expected] : expected).toContain(result.data);
		}
	});
});
