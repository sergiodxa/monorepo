/**
 * Unit tests for `media.ts`, the raw viewport/feature media-query escape hatch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { border } from "../color/border";
import { declarations, serialize } from "../internal/serialize";

import { media } from "./media";

describe("media", () => {
	test("nests the wrapped utility's styles under '@media <query>'", async () => {
		let mixin = media("(prefers-contrast: more)", border("brand.strong"));

		expect(await serialize(mixin)).toContain("@media (prefers-contrast: more) {");
		expect(await declarations(mixin)).toEqual(["border-color: var(--ui-brand-border-strong)"]);
	});

	test("the wrapped declarations land inside the at-rule block, not beside it", async () => {
		expect(await serialize(media("(prefers-contrast: more)", border("brand.strong")))).toMatch(
			/@media \(prefers-contrast: more\) \{[\s\S]*border-color: var\(--ui-brand-border-strong\)[\s\S]*\}/,
		);
	});
});
