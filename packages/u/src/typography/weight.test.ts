/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { weight } from "./weight";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("weight", () => {
	test("every named alias resolves its numeric weight", () => {
		expect(styles(weight("thin"))).toEqual({ fontWeight: 100 });
		expect(styles(weight("extralight"))).toEqual({ fontWeight: 200 });
		expect(styles(weight("light"))).toEqual({ fontWeight: 300 });
		expect(styles(weight("normal"))).toEqual({ fontWeight: 400 });
		expect(styles(weight("medium"))).toEqual({ fontWeight: 500 });
		expect(styles(weight("semibold"))).toEqual({ fontWeight: 600 });
		expect(styles(weight("bold"))).toEqual({ fontWeight: 700 });
		expect(styles(weight("extrabold"))).toEqual({ fontWeight: 800 });
		expect(styles(weight("black"))).toEqual({ fontWeight: 900 });
	});

	test("a raw number passes through unchanged", () => {
		expect(styles(weight(550))).toEqual({ fontWeight: 550 });
	});

	test("no-arg defaults to normal", () => {
		expect(styles(weight())).toEqual({ fontWeight: 400 });
	});
});
