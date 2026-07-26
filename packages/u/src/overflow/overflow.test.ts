/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { overflow } from "./overflow";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("overflow", () => {
	test("no-arg defaults to hidden", () => {
		expect(styles(overflow())).toEqual({ overflow: "hidden" });
	});

	test("an explicit keyword form", () => {
		expect(styles(overflow("auto"))).toEqual({ overflow: "auto" });
	});

	test("the axis-object overload sets overflow-x and overflow-y independently", () => {
		expect(styles(overflow({ x: "hidden", y: "auto" }))).toEqual({
			overflowX: "hidden",
			overflowY: "auto",
		});
	});

	test("the axis-object overload with only x given leaves y untouched", () => {
		expect(styles(overflow({ x: "hidden" }))).toEqual({ overflowX: "hidden" });
	});

	test("the axis-object overload with only y given leaves x untouched", () => {
		expect(styles(overflow({ y: "auto" }))).toEqual({ overflowY: "auto" });
	});

	test("the axis-object overload sets overflow-inline and overflow-block independently", () => {
		expect(styles(overflow({ inline: "hidden", block: "auto" }))).toEqual({
			overflowInline: "hidden",
			overflowBlock: "auto",
		});
	});

	test("the axis-object overload with only inline given leaves block untouched", () => {
		expect(styles(overflow({ inline: "hidden" }))).toEqual({ overflowInline: "hidden" });
	});

	test("the axis-object overload with only block given leaves inline untouched", () => {
		expect(styles(overflow({ block: "auto" }))).toEqual({ overflowBlock: "auto" });
	});
});
