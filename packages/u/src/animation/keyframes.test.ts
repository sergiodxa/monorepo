/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { keyframes } from "./keyframes";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("keyframes", () => {
	test("emits only the @keyframes rule for the given name and frames", () => {
		let mixin = keyframes("fade-in", { from: { opacity: 0 }, to: { opacity: 1 } });

		expect(styles(mixin)).toEqual({
			"@keyframes fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
		});
	});

	test("never emits host declarations such as animationName", () => {
		let mixin = keyframes("fade-in", { from: { opacity: 0 }, to: { opacity: 1 } });
		let result = styles(mixin);

		expect(result.animationName).toBeUndefined();
		expect(result.animationDuration).toBeUndefined();
		expect(Object.keys(result)).toEqual(["@keyframes fade-in"]);
	});
});
