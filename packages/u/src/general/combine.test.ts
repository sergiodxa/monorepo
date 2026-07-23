/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { border } from "../color/border";
import { rounded } from "../effects/rounded";
import { when } from "../state/when";

import { combine } from "./combine";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("combine", () => {
	test("merges several utilities' styles into one flat object, with no wrapping key", () => {
		expect(styles(combine([rounded("lg"), border({ color: "neutral", width: 1 })]))).toEqual({
			borderRadius: "var(--ui-radius-lg, 0.5rem)",
			borderColor: "var(--ui-neutral-border)",
			borderWidth: "1px",
			borderStyle: "solid",
		});
	});

	test("merges already-nested utilities, each keeping its own selector as a sibling", () => {
		expect(
			styles(
				combine([
					when("&:hover", rounded("lg")),
					when("&:focus", border({ color: "neutral", width: 1 })),
				]),
			),
		).toEqual({
			"&:hover": { borderRadius: "var(--ui-radius-lg, 0.5rem)" },
			"&:focus": {
				borderColor: "var(--ui-neutral-border)",
				borderWidth: "1px",
				borderStyle: "solid",
			},
		});
	});

	test("drops falsy entries the same way a mix array would", () => {
		expect(styles(combine([rounded("lg"), false, null, undefined]))).toEqual({
			borderRadius: "var(--ui-radius-lg, 0.5rem)",
		});
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(combine([rounded("lg")])).not.toBe(combine([rounded("lg")]));
	});
});
