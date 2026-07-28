/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";
import { border } from "../color/border";
import { opacity } from "../effects/opacity";

import { hasSibling } from "./has-sibling";
import { precededBy } from "./preceded-by";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("precededBy", () => {
	test("nests under '{selector} ~ &'", () => {
		expect(styles(precededBy("input:checked", bg("brand.solid")))).toEqual({
			"input:checked ~ &": { backgroundColor: "var(--ui-brand-bg-solid)" },
		});
	});

	test("an arbitrary selector passes through verbatim", () => {
		expect(styles(precededBy("*:hover", opacity(100)))).toEqual({
			"*:hover ~ &": { opacity: 1 },
		});
	});

	test("merges an array of utilities into one nested block", () => {
		expect(styles(precededBy("input:checked", [border("brand.solid"), opacity(100)]))).toEqual({
			"input:checked ~ &": {
				borderColor: "var(--ui-brand-bg-solid)",
				opacity: 1,
			},
		});
	});

	test("drops falsy input", () => {
		expect(styles(precededBy("input:checked", false))).toEqual({ "input:checked ~ &": {} });
	});
});

describe("precededBy vs hasSibling", () => {
	test("the two wrappers are mirrors, differing only in source order", () => {
		let forward = styles(hasSibling("input:checked", opacity(100)));
		let backward = styles(precededBy("input:checked", opacity(100)));

		expect(Object.keys(forward)).toEqual(["&:has(~ input:checked)"]);
		expect(Object.keys(backward)).toEqual(["input:checked ~ &"]);
		expect(Object.values(forward)).toEqual(Object.values(backward));
	});
});
