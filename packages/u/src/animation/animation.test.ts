/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations, serialize } from "../internal/serialize";

import { animation, animationHost } from "./animation";

/**
 * Reads back the generated `ui-anim-{hash}` name from the emitted CSS, which
 * is the only place the unnamed form's name is observable.
 */
function generatedName(css: string): string {
	return css.match(/@keyframes (ui-anim-[0-9a-z]+)/)?.[1] ?? "";
}

describe("animation", () => {
	describe("named form", () => {
		test("merges the @keyframes block and the host animation-* declarations", async () => {
			let mixin = animation("fade-in", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "150ms",
				easing: "ease-out",
			});

			expect(await serialize(mixin)).toContain("@keyframes fade-in");
			expect(await declarations(mixin)).toEqual([
				"opacity: 0",
				"opacity: 1",
				"animation-name: fade-in",
				"animation-duration: 150ms",
				"animation-timing-function: ease-out",
			]);
		});

		test("omits animation-timing-function entirely when easing isn't given", async () => {
			let mixin = animation("fade-in", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "150ms",
			});

			expect(await declarations(mixin)).toEqual([
				"opacity: 0",
				"opacity: 1",
				"animation-name: fade-in",
				"animation-duration: 150ms",
			]);
		});

		test("sets animation-iteration-count, animation-direction, and animation-fill-mode when given", async () => {
			let mixin = animation("spin", {
				keyframes: { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
				duration: "1s",
				easing: "linear",
				iterationCount: "infinite",
				direction: "alternate",
				fillMode: "both",
			});

			expect(await serialize(mixin)).toContain("@keyframes spin");
			expect(await declarations(mixin)).toEqual([
				"transform: rotate(0deg)",
				"transform: rotate(360deg)",
				"animation-name: spin",
				"animation-duration: 1s",
				"animation-timing-function: linear",
				"animation-iteration-count: infinite",
				"animation-direction: alternate",
				"animation-fill-mode: both",
			]);
		});

		test("accepts a numeric iterationCount and emits it without a unit", async () => {
			// Regression: the count used to be emitted as a bare number, and the
			// serializer's px-appending turned it into
			// `animation-iteration-count: 2px`, an invalid declaration browsers
			// drop — the animation silently ran once.
			let mixin = animation("bounce", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "300ms",
				iterationCount: 2,
			});

			expect(await declarations(mixin)).toContain("animation-iteration-count: 2");
		});

		test("omits iterationCount, direction, and fillMode entirely when not given", async () => {
			let css = await serialize(
				animation("fade-in", {
					keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
					duration: "150ms",
				}),
			);

			expect(css).not.toContain("animation-iteration-count");
			expect(css).not.toContain("animation-direction");
			expect(css).not.toContain("animation-fill-mode");
		});

		test("sets animation-delay when delay is given", async () => {
			let mixin = animation("fade-in", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "150ms",
				delay: "150ms",
			});

			expect(await declarations(mixin)).toEqual([
				"opacity: 0",
				"opacity: 1",
				"animation-name: fade-in",
				"animation-duration: 150ms",
				"animation-delay: 150ms",
			]);
		});

		test("keeps a negative delay, which seeks into the animation instead of waiting", async () => {
			let mixin = animation("spin", {
				keyframes: { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
				duration: "1s",
				delay: "-500ms",
				iterationCount: "infinite",
			});

			expect(await declarations(mixin)).toContain("animation-delay: -500ms");
		});

		test("omits animation-delay entirely when delay isn't given", async () => {
			let css = await serialize(
				animation("fade-in", {
					keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
					duration: "150ms",
				}),
			);

			expect(css).not.toContain("animation-delay");
		});

		test("sets animation-timeline and animation-range when given", async () => {
			let mixin = animation("reveal", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "auto",
				timeline: "view()",
				range: "entry 0% cover 40%",
			});

			expect(await serialize(mixin)).toContain("@keyframes reveal");
			expect(await declarations(mixin)).toEqual([
				"opacity: 0",
				"opacity: 1",
				"animation-name: reveal",
				"animation-duration: auto",
				"animation-timeline: view()",
				"animation-range: entry 0% cover 40%",
			]);
		});

		test("omits animation-timeline and animation-range entirely when not given", async () => {
			let css = await serialize(
				animation("fade-in", {
					keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
					duration: "150ms",
				}),
			);

			expect(css).not.toContain("animation-timeline");
			expect(css).not.toContain("animation-range");
		});
	});

	describe("unnamed form", () => {
		test("generates a ui-anim-{hash} name used for both the @keyframes key and animation-name", async () => {
			let mixin = animation({
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "150ms",
			});
			let css = await serialize(mixin);
			let name = generatedName(css);

			expect(name).toMatch(/^ui-anim-[0-9a-z]+$/);
			expect(css).toContain(`@keyframes ${name}`);
			expect(await declarations(mixin)).toEqual([
				"opacity: 0",
				"opacity: 1",
				`animation-name: ${name}`,
				"animation-duration: 150ms",
			]);
		});

		test("two calls with identical keyframe content generate the identical name", async () => {
			let first = await serialize(
				animation({ keyframes: { from: { opacity: 0 }, to: { opacity: 1 } }, duration: "150ms" }),
			);
			let second = await serialize(
				animation({ keyframes: { from: { opacity: 0 }, to: { opacity: 1 } }, duration: "200ms" }),
			);

			expect(generatedName(first)).toEqual(generatedName(second));
		});

		test("different keyframe content generates a different name", async () => {
			let first = await serialize(
				animation({ keyframes: { from: { opacity: 0 }, to: { opacity: 1 } }, duration: "150ms" }),
			);
			let second = await serialize(
				animation({
					keyframes: { from: { transform: "scale(0)" }, to: { transform: "scale(1)" } },
					duration: "150ms",
				}),
			);

			expect(generatedName(first)).not.toEqual(generatedName(second));
		});
	});
});

describe("animationHost", () => {
	test("emits only the host animation-* declarations, no @keyframes rule", async () => {
		let mixin = animationHost("ui-spin-rotate", {
			duration: "1s",
			easing: "linear",
			iterationCount: "infinite",
		});

		expect(await serialize(mixin)).not.toContain("@keyframes");
		expect(await declarations(mixin)).toEqual([
			"animation-name: ui-spin-rotate",
			"animation-duration: 1s",
			"animation-timing-function: linear",
			"animation-iteration-count: infinite",
		]);
	});

	test("picks up the delay key for free, since it takes every AnimationConfig key but keyframes", async () => {
		let mixin = animationHost("ui-fade", { duration: "150ms", delay: "150ms" });

		expect(await declarations(mixin)).toEqual([
			"animation-name: ui-fade",
			"animation-duration: 150ms",
			"animation-delay: 150ms",
		]);
	});

	test("omits every optional field entirely when not given, same as animation()'s host half", async () => {
		let mixin = animationHost("ui-fade", { duration: "150ms" });

		expect(await serialize(mixin)).not.toContain("animation-delay");
		expect(await declarations(mixin)).toEqual([
			"animation-name: ui-fade",
			"animation-duration: 150ms",
		]);
	});

	test("a numeric iterationCount survives serialization without a px suffix", async () => {
		let mixin = animationHost("bounce", { duration: "300ms", iterationCount: 2 });

		expect(await declarations(mixin)).toContain("animation-iteration-count: 2");
		expect(await declarations(mixin)).not.toContain("animation-iteration-count: 2px");
	});
});
