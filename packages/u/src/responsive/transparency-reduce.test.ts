/**
 * Unit tests for `transparency-reduce.ts`, sugar over
 * `media("(prefers-reduced-transparency: reduce)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";
import { hover } from "../state/hover";

import { media } from "./media";
import { transparencyReduce } from "./transparency-reduce";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("transparencyReduce", () => {
	test("nests the wrapped utility's styles under '@media (prefers-reduced-transparency: reduce)'", () => {
		expect(styles(transparencyReduce(bg()))).toEqual({
			"@media (prefers-reduced-transparency: reduce)": {
				backgroundColor: "var(--ui-bg, Canvas)",
			},
		});
	});

	test("produces the identical shape media('(prefers-reduced-transparency: reduce)', input) would", () => {
		expect(styles(transparencyReduce(bg()))).toEqual(
			styles(media("(prefers-reduced-transparency: reduce)", bg())),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", () => {
		expect(styles(transparencyReduce(hover(bg("brand.tint"))))).toEqual({
			"@media (prefers-reduced-transparency: reduce)": {
				"&:hover": { backgroundColor: "var(--ui-brand-bg-tint)" },
			},
		});
	});
});
