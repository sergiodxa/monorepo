/**
 * Unit tests for `has.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize.js";
import { p } from "../size/p.js";

import { has } from "./has.js";

describe("has", () => {
	test("emits an '&:has(selector)' block around the input's declarations", async () => {
		expect(await serialize(has("img", p(4)))).toContain("&:has(img) {");
		expect(await declarations(has("img", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("a compound selector reaches the stylesheet untouched", async () => {
		expect(await serialize(has('[aria-selected="true"]', p(4)))).toContain(
			'&:has([aria-selected="true"]) {',
		);
	});
});
