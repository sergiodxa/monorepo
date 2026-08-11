/**
 * Unit tests for `print.ts`, sugar over `media("print", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { bg } from "../color/bg";
import { raw } from "../general/raw";
import { serialize } from "../internal/serialize";
import { hover } from "../state/hover";

import { media } from "./media";
import { print } from "./print";

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
