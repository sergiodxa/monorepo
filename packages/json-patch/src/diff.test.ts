/**
 * Checks `diff` by its contract: applying the generated patch to the source yields the
 * target, across hand-picked edits and every document pair in the json-patch-tests suite.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { JSONValue } from "./json-value.js";

import { apply } from "./apply.js";
import { diff } from "./diff.js";

/** Document pairs from the suite's successful cases. */
const SUITE_PAIRS = ["spec_tests.json", "tests.json"].flatMap((file) =>
	(
		JSON.parse(
			readFileSync(join(import.meta.dirname, "fixtures/json-patch-tests", file), "utf8"),
		) as { doc: JSONValue; expected?: JSONValue }[]
	)
		.filter((entry) => entry.expected !== undefined)
		.map((entry) => [entry.doc, entry.expected as JSONValue] as const),
);

describe("diff", () => {
	test("returns no operations for equal documents, whatever the member order", () => {
		expect(diff({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 })).toEqual([]);
	});

	test("inserts a single array element instead of rewriting the tail", () => {
		expect(diff({ tags: ["a", "c", "d"] }, { tags: ["a", "b", "c", "d"] })).toEqual([
			{ op: "add", path: "/tags/1", value: "b" },
		]);
	});

	test("removes a single array element", () => {
		expect(diff([1, 2, 3, 4], [1, 3, 4])).toEqual([{ op: "remove", path: "/1" }]);
	});

	test("writes explicit null as a replace", () => {
		expect(diff({ a: 1 }, { a: null })).toEqual([{ op: "replace", path: "/a", value: null }]);
	});

	test("escapes member names in paths", () => {
		expect(diff({}, { "a/b": 1, "m~n": 2 })).toEqual([
			{ op: "add", path: "/a~1b", value: 1 },
			{ op: "add", path: "/m~0n", value: 2 },
		]);
	});

	test.each([
		[{ a: 1 }, [1]],
		[
			[1, 2, 3],
			[3, 2, 1],
		],
		[[{ a: 1 }, { b: 2 }], [{ a: 2 }]],
		[[1], [1, 2, 3, 4]],
		[[1, 2, 3, 4], [4]],
		[{ deep: { list: [[1], [2]] } }, { deep: { list: [[1, 2], [], [3]] }, x: true }],
		...SUITE_PAIRS,
	] as [JSONValue, JSONValue][])("patch from %j to %j applies", (source, target) => {
		expect(unwrap(apply(source, diff(source, target)))).toEqual(target);
	});
});
