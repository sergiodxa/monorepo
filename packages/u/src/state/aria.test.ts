/**
 * Unit tests for `aria.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { aria } from "./aria";

describe("aria", () => {
	test("with no value, emits the bare attribute selector", async () => {
		expect(await serialize(aria("busy", p(4)))).toContain("&[aria-busy] {");
		expect(await declarations(aria("busy", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("with a value, emits the attribute=value selector with the quotes intact", async () => {
		expect(await serialize(aria("expanded", "true", p(4)))).toContain('&[aria-expanded="true"] {');
		expect(await declarations(aria("expanded", "true", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("a numeric value reaches the selector quoted, as an attribute value must be", async () => {
		expect(await serialize(aria("level", 2, p(4)))).toContain('&[aria-level="2"] {');
	});
});
