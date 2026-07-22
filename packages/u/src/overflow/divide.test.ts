/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { divide } from "./divide";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

/** Same tiny system default `u.border()` falls back to when no color is given. */
const DEFAULT_BORDER_COLOR = "var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent))";

describe("divide", () => {
	test("no args defaults to the block axis, 1px, and the system default border color", () => {
		expect(styles(divide())).toEqual({
			"& > *:not(:last-child)": {
				borderStyle: "solid",
				borderBlockEndWidth: "1px",
				borderBlockEndColor: DEFAULT_BORDER_COLOR,
			},
		});
	});

	test("axis only", () => {
		expect(styles(divide("inline"))).toEqual({
			"& > *:not(:last-child)": {
				borderStyle: "solid",
				borderInlineEndWidth: "1px",
				borderInlineEndColor: DEFAULT_BORDER_COLOR,
			},
		});
	});

	test("axis + color", () => {
		expect(styles(divide("block", "brand"))).toEqual({
			"& > *:not(:last-child)": {
				borderStyle: "solid",
				borderBlockEndWidth: "1px",
				borderBlockEndColor: "var(--ui-brand-border)",
			},
		});
	});

	test("axis + color + width", () => {
		expect(styles(divide("block", "brand", 2))).toEqual({
			"& > *:not(:last-child)": {
				borderStyle: "solid",
				borderBlockEndWidth: "2px",
				borderBlockEndColor: "var(--ui-brand-border)",
			},
		});
	});

	test("axis + width, with no color, still resolves the system default color", () => {
		expect(styles(divide("block", 2))).toEqual({
			"& > *:not(:last-child)": {
				borderStyle: "solid",
				borderBlockEndWidth: "2px",
				borderBlockEndColor: DEFAULT_BORDER_COLOR,
			},
		});
	});
});
