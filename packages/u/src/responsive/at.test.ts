/**
 * Unit tests for `at.ts`, the container-query wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize.js";
import { p } from "../size/p.js";

import { at } from "./at.js";

describe("at", () => {
	test("nests the wrapped utility's styles under a container query for a known name", async () => {
		expect(await serialize(at("md", p(4)))).toMatch(
			/@container \(min-width: 36rem\) \{[\s\S]*padding: calc\(var\(--ui-spacing, 0\.25rem\) \* 4\)/,
		);
	});

	test("the wrapped utility's declaration survives the serializer unchanged", async () => {
		expect(await declarations(at("md", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("resolves a named step to a literal length, never a var() reference", async () => {
		for (let size of ["xs", "sm", "md", "lg", "xl", "2xl"] as const) {
			let condition = (await serialize(at(size, p(4)))).match(/@container [^{]+/)?.[0];
			expect(condition).not.toContain("var(");
		}
	});

	test("falls back to the md length for an unrecognized name", async () => {
		expect(await serialize(at("made-up", p(4)))).toContain("@container (min-width: 36rem) {");
	});

	test("a third argument targets a specific named container instead of the nearest one", async () => {
		expect(await serialize(at("md", "sidebar", p(4)))).toContain(
			"@container sidebar (min-width: 36rem) {",
		);
	});

	test("a literal CSS length is used as-is, not wrapped in a var() token reference", async () => {
		expect(await serialize(at("40rem", p(4)))).toContain("@container (min-width: 40rem) {");
	});

	test("a literal length still composes with a named container target", async () => {
		expect(await serialize(at("40rem", "ui-dialog", p(4)))).toContain(
			"@container ui-dialog (min-width: 40rem) {",
		);
	});
});
