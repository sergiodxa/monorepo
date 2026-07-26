/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { roundedCorner } from "./rounded-corner";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("roundedCorner", () => {
	test("no radius name defaults to the md radius", () => {
		expect(styles(roundedCorner("end-start"))).toEqual({
			borderEndStartRadius: "var(--ui-radius-md, 0.375rem)",
		});
	});

	test("start-start corner with an explicit named radius", () => {
		expect(styles(roundedCorner("start-start", "sm"))).toEqual({
			borderStartStartRadius: "var(--ui-radius-sm, 0.25rem)",
		});
	});

	test("end-end corner with an explicit named radius", () => {
		expect(styles(roundedCorner("end-end", "lg"))).toEqual({
			borderEndEndRadius: "var(--ui-radius-lg, 0.5rem)",
		});
	});

	test("start-end corner with a raw CSS length", () => {
		expect(styles(roundedCorner("start-end", "3px"))).toEqual({
			borderStartEndRadius: "var(--ui-radius-3px, 0px)",
		});
	});
});
