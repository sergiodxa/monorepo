/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { rounded } from "./rounded";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("rounded", () => {
	test("no-arg defaults to the md radius", () => {
		expect(styles(rounded())).toEqual({ borderRadius: "var(--ui-radius-md, 0.375rem)" });
	});

	test("an explicit named radius", () => {
		expect(styles(rounded("lg"))).toEqual({ borderRadius: "var(--ui-radius-lg, 0.5rem)" });
	});

	test("the inherit keyword bypasses token resolution", () => {
		expect(styles(rounded("inherit"))).toEqual({ borderRadius: "inherit" });
	});
});
