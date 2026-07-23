/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { when } from "../state/when";

import { raw } from "./raw";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("raw", () => {
	test("passes a plain style object through unchanged", () => {
		expect(styles(raw({ color: "var(--ui-chart-1)" }))).toEqual({
			color: "var(--ui-chart-1)",
		});
	});

	test("composes inside when(), same as any other utility mixin", () => {
		expect(styles(when('&[data-color="1"]', raw({ color: "var(--ui-chart-1)" })))).toEqual({
			'&[data-color="1"]': { color: "var(--ui-chart-1)" },
		});
	});
});
