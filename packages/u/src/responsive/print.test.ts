/**
 * Unit tests for `print.ts`, sugar over `media("print", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg.js";
import { raw } from "../general/raw.js";
import { serialize } from "../internal/serialize.js";
import { hover } from "../state/hover.js";

import { media } from "./media.js";
import { print } from "./print.js";

describe("print", () => {
	test("nests the wrapped utility's styles under the bare media type '@media print'", async () => {
		expect(await serialize(print(raw({ display: "none" })))).toMatch(
			/@media print \{[\s\S]*display: none;/,
		);
	});

	test("never wraps the media type in parentheses the way a feature query would be", async () => {
		let css = await serialize(print(bg()));

		expect(css).toContain("@media print {");
		expect(css).not.toContain("@media (print");
	});

	test("produces the identical stylesheet media('print', input) would", async () => {
		expect(await serialize(print(bg()))).toBe(await serialize(media("print", bg())));
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", async () => {
		expect(await serialize(print(hover(bg("brand.tint"))))).toMatch(
			/@media print \{[\s\S]*&:hover \{[\s\S]*background-color: var\(--ui-brand-bg-tint\)/,
		);
	});
});
