/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { textAlign } from "./text-align";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("textAlign", () => {
	test("no-arg defaults to the logical start keyword", () => {
		expect(styles(textAlign())).toEqual({ textAlign: "start" });
	});

	test("center", () => {
		expect(styles(textAlign("center"))).toEqual({ textAlign: "center" });
	});

	test("end", () => {
		expect(styles(textAlign("end"))).toEqual({ textAlign: "end" });
	});

	test("justify", () => {
		expect(styles(textAlign("justify"))).toEqual({ textAlign: "justify" });
	});

	test("never emits the physical left/right keywords", () => {
		let values = [
			styles(textAlign()).textAlign,
			styles(textAlign("center")).textAlign,
			styles(textAlign("end")).textAlign,
			styles(textAlign("justify")).textAlign,
		];

		expect(values).not.toContain("left");
		expect(values).not.toContain("right");
	});
});
