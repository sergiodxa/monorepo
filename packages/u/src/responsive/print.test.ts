/**
 * Unit tests for `print.ts`, sugar over `media("print", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";
import { raw } from "../general/raw";
import { hover } from "../state/hover";

import { media } from "./media";
import { print } from "./print";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("print", () => {
	test("nests the wrapped utility's styles under the bare media type '@media print'", () => {
		expect(styles(print(raw({ display: "none" })))).toEqual({
			"@media print": { display: "none" },
		});
	});

	test("never wraps the media type in parentheses the way a feature query would be", () => {
		expect(Object.keys(styles(print(bg())))).toEqual(["@media print"]);
	});

	test("produces the identical shape media('print', input) would", () => {
		expect(styles(print(bg()))).toEqual(styles(media("print", bg())));
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", () => {
		expect(styles(print(hover(bg("brand.tint"))))).toEqual({
			"@media print": {
				"&:hover": { backgroundColor: "var(--ui-brand-bg-tint)" },
			},
		});
	});
});
