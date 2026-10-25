/**
 * Runs the community json-patch-tests suite, which carries RFC 6902's Appendix A as
 * `spec_tests.json`, through `apply`: every enabled case must produce its expected
 * document or fail, and a failing case must leave the input untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { JSONValue } from "./json-value.js";
import type { Operation } from "./operation.js";

import { apply } from "./apply.js";

/** One case of the suite: `error` marks a patch that must fail, `expected` the result otherwise. */
interface SuiteCase {
	comment?: string;
	doc: JSONValue;
	patch: Operation[];
	expected?: JSONValue;
	error?: string;
	disabled?: boolean;
}

/** Directory holding the vendored suite and its license. */
const SUITE = join(import.meta.dirname, "fixtures/json-patch-tests");

/** The enabled cases of one suite file, labelled for the test report. */
function cases(file: string): (SuiteCase & { label: string })[] {
	let all = JSON.parse(readFileSync(join(SUITE, file), "utf8")) as SuiteCase[];
	return all
		.filter((entry) => !entry.disabled)
		.map((entry, index) => ({ ...entry, label: entry.comment ?? entry.error ?? `case ${index}` }));
}

describe.each(["spec_tests.json", "tests.json"])("%s", (file) => {
	test.each(cases(file))("$label", (entry) => {
		let before = structuredClone(entry.doc);
		let result = apply(entry.doc, entry.patch);

		if (entry.error !== undefined) {
			expect(isFailure(result)).toBe(true);
		} else if (entry.expected !== undefined) {
			expect(unwrap(result)).toEqual(entry.expected);
		} else {
			expect(isSuccess(result)).toBe(true);
		}
		expect(entry.doc).toEqual(before);
	});
});
