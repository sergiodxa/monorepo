/**
 * Unit tests for `data.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { data } from "./data";

describe("data", () => {
	test("with no value, emits the bare attribute selector", async () => {
		expect(await serialize(data("disabled", p(4)))).toContain("&[data-disabled] {");
		expect(await declarations(data("disabled", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("with a value, emits the attribute=value selector with the quotes intact", async () => {
		expect(await serialize(data("orientation", "vertical", p(4)))).toContain(
			'&[data-orientation="vertical"] {',
		);
		expect(await declarations(data("orientation", "vertical", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("a numeric value reaches the selector quoted, as an attribute value must be", async () => {
		expect(await serialize(data("count", 3, p(4)))).toContain('&[data-count="3"] {');
	});
});
