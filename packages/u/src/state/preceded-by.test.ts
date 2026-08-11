/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { bg } from "../color/bg";
import { border } from "../color/border";
import { opacity } from "../effects/opacity";
import { declarations, serialize } from "../internal/serialize";

import { hasSibling } from "./has-sibling";
import { precededBy } from "./preceded-by";

describe("precededBy", () => {
	test("emits a ':is({selector}) ~ &' block", async () => {
		expect(await serialize(precededBy("input:checked", bg("brand.solid")))).toContain(
			":is(input:checked) ~ & {",
		);
		expect(await declarations(precededBy("input:checked", bg("brand.solid")))).toEqual([
			"background-color: var(--ui-brand-bg-solid)",
		]);
	});

	test("the selector is wrapped, never emitted bare", async () => {
		// Regression: the sibling selector used to be interpolated bare, as
		// `input:checked ~ &`. The serializer only treats a key starting with
		// `&`, `@`, `:`, `[` or `.` as a nested selector, so that key was emitted
		// as a declaration — `input:checked ~ &: [object Object];` — and every
		// rule this utility ever produced was silently discarded by the browser.
		let css = await serialize(precededBy("input:checked", opacity(100)));

		expect(css).not.toContain("[object Object]");
		expect(css).toContain(":is(input:checked) ~ & {\n    opacity: 1;\n  }");
	});

	test("an arbitrary selector passes through inside the :is()", async () => {
		expect(await serialize(precededBy("*:hover", opacity(100)))).toContain(":is(*:hover) ~ & {");
		expect(await declarations(precededBy("*:hover", opacity(100)))).toEqual(["opacity: 1"]);
	});

	test("merges an array of utilities into one nested block", async () => {
		let input = [border("brand.solid"), opacity(100)];

		expect((await serialize(precededBy("input:checked", input))).split(" ~ & {")).toHaveLength(2);
		expect(await declarations(precededBy("input:checked", input))).toEqual([
			"border-color: var(--ui-brand-bg-solid)",
			"opacity: 1",
		]);
	});

	test("drops falsy input, emitting no CSS at all", async () => {
		expect(await serialize(precededBy("input:checked", false))).toBe("");
	});
});

describe("precededBy vs hasSibling", () => {
	test("the two wrappers are mirrors, differing only in source order", async () => {
		expect(await serialize(hasSibling("input:checked", opacity(100)))).toContain(
			"&:has(~ input:checked) {",
		);
		expect(await serialize(precededBy("input:checked", opacity(100)))).toContain(
			":is(input:checked) ~ & {",
		);
		expect(await declarations(hasSibling("input:checked", opacity(100)))).toEqual(
			await declarations(precededBy("input:checked", opacity(100))),
		);
	});
});
