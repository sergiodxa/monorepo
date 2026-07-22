/**
 * Unit tests for `justify()`'s default value, plain keywords, and the
 * `between`/`around`/`evenly` aliasing to their `space-*` CSS keywords.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { justify } from "./justify";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("justify", () => {
	test("defaults to start", () => {
		expect(styles(justify())).toEqual({ justifyContent: "start" });
	});

	test("passes a plain keyword through unchanged", () => {
		expect(styles(justify("center"))).toEqual({ justifyContent: "center" });
	});

	test("aliases between to space-between", () => {
		expect(styles(justify("between"))).toEqual({ justifyContent: "space-between" });
	});

	test("aliases around to space-around", () => {
		expect(styles(justify("around"))).toEqual({ justifyContent: "space-around" });
	});

	test("aliases evenly to space-evenly", () => {
		expect(styles(justify("evenly"))).toEqual({ justifyContent: "space-evenly" });
	});
});
