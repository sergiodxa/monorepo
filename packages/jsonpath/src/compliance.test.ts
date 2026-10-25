/**
 * Runs the official jsonpath-compliance-test-suite: every invalid selector must fail to
 * parse, and every valid one must select the expected values with their normalized paths
 * (or one of the listed results where object member order leaves the result open).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { JSONValue } from "./ast.js";

import { JSONPath } from "./json-path.js";

/** One suite case. */
interface SuiteCase {
	name: string;
	selector: string;
	document?: JSONValue;
	result?: JSONValue[];
	result_paths?: string[];
	results?: JSONValue[][];
	results_paths?: string[][];
	invalid_selector?: boolean;
}

/** Every case in the vendored suite. */
const CASES = (
	JSON.parse(
		readFileSync(
			join(import.meta.dirname, "fixtures/jsonpath-compliance-test-suite/cts.json"),
			"utf8",
		),
	) as { tests: SuiteCase[] }
).tests;

describe("jsonpath-compliance-test-suite", () => {
	test.each(CASES.filter((entry) => entry.invalid_selector))("rejects $name", (entry) => {
		expect(isFailure(JSONPath.parse(entry.selector))).toBe(true);
	});

	test.each(CASES.filter((entry) => !entry.invalid_selector))("selects $name", (entry) => {
		let nodes = unwrap(JSONPath.parse(entry.selector)).select(entry.document as JSONValue);
		let values = nodes.map((node) => node.value);
		let paths = nodes.map((node) => node.path);
		if (entry.result !== undefined) {
			expect(values).toEqual(entry.result);
			expect(paths).toEqual(entry.result_paths);
		} else {
			let index = (entry.results ?? []).findIndex(
				(candidate, at) =>
					JSON.stringify(candidate) === JSON.stringify(values) &&
					JSON.stringify(entry.results_paths?.[at]) === JSON.stringify(paths),
			);
			expect(index, JSON.stringify({ values, paths })).toBeGreaterThanOrEqual(0);
		}
	});
});
