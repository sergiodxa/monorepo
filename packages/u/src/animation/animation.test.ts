/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { animation, animationHost } from "./animation";

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

		test("sets animationIterationCount, animationDirection, and animationFillMode when given", () => {
			let mixin = animation("spin", {
				keyframes: { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
				duration: "1s",
				easing: "linear",
				iterationCount: "infinite",
				direction: "alternate",
				fillMode: "both",
			});

			expect(styles(mixin)).toEqual({
				"@keyframes spin": {
					from: { transform: "rotate(0deg)" },
					to: { transform: "rotate(360deg)" },
				},
				animationName: "spin",
				animationDuration: "1s",
				animationTimingFunction: "linear",
				animationIterationCount: "infinite",
				animationDirection: "alternate",
				animationFillMode: "both",
			});
		});

		test("accepts a numeric iterationCount", () => {
			let mixin = animation("bounce", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "300ms",
				iterationCount: 2,
			});

			expect(styles(mixin).animationIterationCount).toBe(2);
		});

		test("omits iterationCount, direction, and fillMode entirely when not given", () => {
			let mixin = animation("fade-in", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "150ms",
			});
			let result = styles(mixin);

			expect("animationIterationCount" in result).toBe(false);
			expect("animationDirection" in result).toBe(false);
			expect("animationFillMode" in result).toBe(false);
		});

		test("sets animationDelay when delay is given", () => {
			let mixin = animation("fade-in", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "150ms",
				delay: "150ms",
			});

			expect(styles(mixin)).toEqual({
				"@keyframes fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
				animationName: "fade-in",
				animationDuration: "150ms",
				animationDelay: "150ms",
			});
		});

		test("keeps a negative delay, which seeks into the animation instead of waiting", () => {
			let mixin = animation("spin", {
				keyframes: { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
				duration: "1s",
				delay: "-500ms",
				iterationCount: "infinite",
			});

			expect(styles(mixin).animationDelay).toBe("-500ms");
		});

		test("omits animationDelay entirely when delay isn't given", () => {
			let mixin = animation("fade-in", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "150ms",
			});

			expect("animationDelay" in styles(mixin)).toBe(false);
		});

		test("sets animationTimeline and animationRange when given", () => {
			let mixin = animation("reveal", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "auto",
				timeline: "view()",
				range: "entry 0% cover 40%",
			});

			expect(styles(mixin)).toEqual({
				"@keyframes reveal": { from: { opacity: 0 }, to: { opacity: 1 } },
				animationName: "reveal",
				animationDuration: "auto",
				animationTimeline: "view()",
				animationRange: "entry 0% cover 40%",
			});
		});

		test("omits animationTimeline and animationRange entirely when not given", () => {
			let mixin = animation("fade-in", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "150ms",
			});
			let result = styles(mixin);

			expect("animationTimeline" in result).toBe(false);
			expect("animationRange" in result).toBe(false);
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

describe("animationHost", () => {
	test("emits only the host animation-* declarations, no @keyframes key", () => {
		let mixin = animationHost("ui-spin-rotate", {
			duration: "1s",
			easing: "linear",
			iterationCount: "infinite",
		});
		let result = styles(mixin);

		expect("@keyframes ui-spin-rotate" in result).toBe(false);
		expect(result).toEqual({
			animationName: "ui-spin-rotate",
			animationDuration: "1s",
			animationTimingFunction: "linear",
			animationIterationCount: "infinite",
		});
	});

	test("picks up the delay key for free, since it takes every AnimationConfig key but keyframes", () => {
		let result = styles(animationHost("ui-fade", { duration: "150ms", delay: "150ms" }));

		expect(result).toEqual({
			animationName: "ui-fade",
			animationDuration: "150ms",
			animationDelay: "150ms",
		});
	});

	test("omits every optional field entirely when not given, same as animation()'s host half", () => {
		let result = styles(animationHost("ui-fade", { duration: "150ms" }));

		expect("animationDelay" in result).toBe(false);
		expect(result).toEqual({ animationName: "ui-fade", animationDuration: "150ms" });
	});
});
