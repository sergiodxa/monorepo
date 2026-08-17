/**
 * Unit tests for `at-max.ts`, the max-width container-query wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { atMax } from "./at";

describe("atMax", () => {
	test("nests the wrapped utility's styles under a max-width container query for a known name", async () => {
		expect(await serialize(atMax("md", p(4)))).toMatch(
			/@container \(max-width: 36rem\) \{[\s\S]*padding: calc\(var\(--ui-spacing, 0\.25rem\) \* 4\)/,
		);
	});

	test("the wrapped utility's declaration survives the serializer unchanged", async () => {
		expect(await declarations(atMax("md", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("resolves a named step to a literal length, never a var() reference", async () => {
		let condition = (await serialize(atMax("lg", p(4)))).match(/@container [^{]+/)?.[0];

		expect(condition).not.toContain("var(");
	});

	test("a literal CSS length is used as-is, not wrapped in a var() token reference", async () => {
		expect(await serialize(atMax("40rem", p(4)))).toContain("@container (max-width: 40rem) {");
	});

	test("a third argument targets a specific named container instead of the nearest one", async () => {
		expect(await serialize(atMax("md", "sidebar", p(4)))).toContain(
			"@container sidebar (max-width: 36rem) {",
		);
	});
});
