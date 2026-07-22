/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { animation } from "./animation";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("animation", () => {
	describe("named form", () => {
		test("merges the @keyframes block and the host animation-* declarations", () => {
			let mixin = animation("fade-in", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "150ms",
				easing: "ease-out",
			});

			expect(styles(mixin)).toEqual({
				"@keyframes fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
				animationName: "fade-in",
				animationDuration: "150ms",
				animationTimingFunction: "ease-out",
			});
		});

		test("omits animationTimingFunction entirely when easing isn't given", () => {
			let mixin = animation("fade-in", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "150ms",
			});
			let result = styles(mixin);

			expect("animationTimingFunction" in result).toBe(false);
			expect(result).toEqual({
				"@keyframes fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
				animationName: "fade-in",
				animationDuration: "150ms",
			});
		});
	});

	describe("unnamed form", () => {
		test("generates a ui-anim-{hash} name used for both the @keyframes key and animationName", () => {
			let mixin = animation({
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "150ms",
			});
			let result = styles(mixin);
			let name = result.animationName as string;

			expect(name).toMatch(/^ui-anim-[0-9a-z]+$/);
			expect(result).toEqual({
				[`@keyframes ${name}`]: { from: { opacity: 0 }, to: { opacity: 1 } },
				animationName: name,
				animationDuration: "150ms",
			});
		});

		test("two calls with identical keyframe content generate the identical name", () => {
			let first = styles(
				animation({
					keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
					duration: "150ms",
				}),
			);
			let second = styles(
				animation({
					keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
					duration: "200ms",
				}),
			);

			expect(first.animationName).toEqual(second.animationName);
		});

		test("different keyframe content generates a different name", () => {
			let first = styles(
				animation({
					keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
					duration: "150ms",
				}),
			);
			let second = styles(
				animation({
					keyframes: { from: { transform: "scale(0)" }, to: { transform: "scale(1)" } },
					duration: "150ms",
				}),
			);

			expect(first.animationName).not.toEqual(second.animationName);
		});
	});
});
