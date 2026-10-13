/**
 * Covers the enter/exit animation factories as pure `css()` output: the
 * `enterExit()` composer's selector defaults, separate entry and exit values
 * and timing, blur, `@starting-style`/reduced-motion emission, plus the
 * `fade()`/`zoom()`/`slide()` presets delegating the right defaults through it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSMixinDescriptor } from "remix/component";

import { describe, expect, test } from "vitest";

import { durations, easings } from "./tokens.js";
import { enterExit, fade, slide, zoom } from "./transitions.js";

const DEFAULT_SELECTOR = "&[open], &:popover-open";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("tokens", () => {
	test("durations are ordered from fastest to slowest", () => {
		expect(durations.fast).toBeLessThan(durations.normal);
		expect(durations.normal).toBeLessThan(durations.slow);
		expect(durations.slow).toBeLessThan(durations.slower);
	});

	test("easings expose CSS-ready cubic-bezier/keyword strings", () => {
		expect(easings.standard).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
		expect(easings.decelerate).toBe("cubic-bezier(0, 0, 0.2, 1)");
		expect(easings.accelerate).toBe("cubic-bezier(0.4, 0, 1, 1)");
		expect(easings.linear).toBe("linear");
	});
});

describe("enterExit", () => {
	test("defaults to the platform-state selector, normal duration, and the standard easing", () => {
		let style = styles(enterExit({ opacity: 0 }));

		expect(style.opacity).toBe(0);
		expect(style.transitionBehavior).toBe("allow-discrete");
		expect(style[DEFAULT_SELECTOR]).toEqual({
			opacity: 1,
			transitionDuration: `${durations.normal}ms`,
			transitionTimingFunction: easings.standard,
		});
	});

	test("only lists the axes actually configured, plus display/overlay, in transitionProperty", () => {
		expect(styles(enterExit({ opacity: 0 })).transitionProperty).toBe("opacity, display, overlay");
		expect(styles(enterExit({ scale: 0.9 })).transitionProperty).toBe("scale, display, overlay");
		expect(
			styles(enterExit({ opacity: 0, scale: 0.9, translate: "0 0.5rem" })).transitionProperty,
		).toBe("opacity, scale, translate, display, overlay");
	});

	test("stringifies scale so the CSS serializer never appends a length unit to it", () => {
		let style = styles(enterExit({ scale: 0.95 }));

		expect(style.scale).toBe("0.95");
		expect(typeof style.scale).toBe("string");
	});

	test("resets scale/translate to none and opacity to 1 in the entered state", () => {
		let style = styles(enterExit({ opacity: 0, scale: 0.9, translate: "0 0.5rem" }));

		expect(style[DEFAULT_SELECTOR]).toMatchObject({ opacity: 1, scale: "none", translate: "none" });
	});

	test("mirrors the exit state inside @starting-style under the same selector", () => {
		let style = styles(enterExit({ opacity: 0, scale: 0.9 }));
		let startingStyle = style["@starting-style"] as Record<string, unknown>;

		expect(startingStyle[DEFAULT_SELECTOR]).toEqual({ opacity: 0, scale: "0.9" });
	});

	test("collapses scale/translate motion under prefers-reduced-motion, keeping opacity", () => {
		let style = styles(enterExit({ opacity: 0, scale: 0.9, translate: "0 0.5rem" }));
		let reduced = style["@media (prefers-reduced-motion: reduce)"] as Record<string, unknown>;

		expect(reduced.transitionProperty).toBe("opacity, display, overlay");
		expect(reduced.scale).toBe("none");
		expect(reduced.translate).toBe("none");
		expect(reduced.opacity).toBeUndefined();
	});

	test("still emits a reduced-motion override for an opacity-only transition", () => {
		let style = styles(enterExit({ opacity: 0 }));
		let reduced = style["@media (prefers-reduced-motion: reduce)"] as Record<string, unknown>;

		expect(reduced.transitionProperty).toBe("opacity, display, overlay");
	});

	test("a custom when selector replaces the platform-state default", () => {
		let style = styles(enterExit({ opacity: 0, when: "[data-visible]" }));

		expect(style["&[data-visible]"]).toMatchObject({ opacity: 1 });
		expect(style[DEFAULT_SELECTOR]).toBeUndefined();
	});

	test("a caller-provided duration and easing override the defaults", () => {
		let style = styles(enterExit({ opacity: 0, duration: 500, easing: easings.linear }));

		expect(style[DEFAULT_SELECTOR]).toMatchObject({
			transitionDuration: "500ms",
			transitionTimingFunction: "linear",
		});
	});

	test("exits on a shorter clock than it enters, reusing the entry easing", () => {
		let style = styles(enterExit({ opacity: 0, duration: 200, easing: easings.decelerate }));

		expect(style.transitionDuration).toBe("150ms");
		expect(style.transitionTimingFunction).toBe(easings.decelerate);
	});

	test("takes its own exit duration and easing", () => {
		let style = styles(enterExit({ opacity: 0, exitDuration: 90, exitEasing: easings.accelerate }));

		expect(style.transitionDuration).toBe("90ms");
		expect(style.transitionTimingFunction).toBe(easings.accelerate);
	});

	test("leaves to the exit values while @starting-style keeps the entry values", () => {
		let style = styles(
			enterExit({ opacity: 0, translate: "100% 0", exit: { translate: "1rem 0" } }),
		);
		let startingStyle = style["@starting-style"] as Record<string, unknown>;

		expect(style.translate).toBe("1rem 0");
		expect(style.opacity).toBe(0);
		expect(startingStyle[DEFAULT_SELECTOR]).toEqual({ opacity: 0, translate: "100% 0" });
	});

	test("a value only the exit names enters from its reset", () => {
		let style = styles(enterExit({ translate: "100% 0", exit: { opacity: 0, blur: 4 } }));
		let startingStyle = style["@starting-style"] as Record<string, unknown>;

		expect(style.opacity).toBe(0);
		expect(style.filter).toBe("blur(4px)");
		expect(startingStyle[DEFAULT_SELECTOR]).toEqual({
			opacity: 1,
			translate: "100% 0",
			filter: "none",
		});
	});

	test("transitions filter for a blur and clears it in the entered state", () => {
		let style = styles(enterExit({ opacity: 0, blur: 4 }));

		expect(style.filter).toBe("blur(4px)");
		expect(style.transitionProperty).toBe("opacity, filter, display, overlay");
		expect(style[DEFAULT_SELECTOR]).toMatchObject({ filter: "none" });
	});

	test("drops the blur along with movement under prefers-reduced-motion", () => {
		let style = styles(enterExit({ opacity: 0, scale: 0.9, blur: 4 }));
		let reduced = style["@media (prefers-reduced-motion: reduce)"] as Record<string, unknown>;

		expect(reduced.filter).toBe("none");
		expect(reduced.transitionProperty).toBe("opacity, display, overlay");
	});
});

describe("fade", () => {
	test("defaults to a fully transparent exit state with no scale or translate", () => {
		let style = styles(fade());

		expect(style.opacity).toBe(0);
		expect(style.scale).toBeUndefined();
		expect(style.translate).toBeUndefined();
		expect(style.transitionProperty).toBe("opacity, display, overlay");
	});

	test("forwards duration, easing, and when to enterExit", () => {
		let style = styles(
			fade({ duration: durations.fast, easing: easings.linear, when: "[data-open]" }),
		);

		expect(style["&[data-open]"]).toEqual({
			opacity: 1,
			transitionDuration: `${durations.fast}ms`,
			transitionTimingFunction: "linear",
		});
	});
});

describe("zoom", () => {
	test("defaults to a transparent, slightly shrunk exit state", () => {
		let style = styles(zoom());

		expect(style.opacity).toBe(0);
		expect(style.scale).toBe("0.975");
		expect(style.transitionProperty).toBe("opacity, scale, display, overlay");
	});

	test("enters from the full scale and exits only halfway back to it", () => {
		let style = styles(zoom({ scale: 0.8 }));
		let startingStyle = style["@starting-style"] as Record<string, unknown>;

		expect(startingStyle[DEFAULT_SELECTOR]).toMatchObject({ scale: "0.8" });
		expect(style.scale).toBe("0.9");
	});

	test("forwards a blur", () => {
		expect(styles(zoom({ blur: 2 })).filter).toBe("blur(2px)");
	});
});

describe("slide", () => {
	/** The `translate` a slide enters from, read out of its `@starting-style` block. */
	function entryTranslate(mixin: CSSMixinDescriptor): unknown {
		let startingStyle = styles(mixin)["@starting-style"] as Record<string, Record<string, unknown>>;
		return startingStyle[DEFAULT_SELECTOR]?.translate;
	}

	test("enters from just off the resting position for each edge", () => {
		expect(entryTranslate(slide({ from: "top" }))).toBe("0 -0.5rem");
		expect(entryTranslate(slide({ from: "bottom" }))).toBe("0 0.5rem");
		expect(entryTranslate(slide({ from: "left" }))).toBe("-0.5rem 0");
		expect(entryTranslate(slide({ from: "right" }))).toBe("0.5rem 0");
	});

	test("exits half the entry distance toward the same edge", () => {
		expect(styles(slide({ from: "top" })).translate).toBe("0 -0.25rem");
		expect(styles(slide({ from: "right" })).translate).toBe("0.25rem 0");
	});

	test("accepts a custom distance, wrapping one it cannot halve directly in calc()", () => {
		expect(entryTranslate(slide({ from: "top", distance: "1rem" }))).toBe("0 -1rem");
		expect(styles(slide({ from: "left", distance: "var(--gap)" })).translate).toBe(
			"calc(-1 * calc(var(--gap) / 2)) 0",
		);
	});

	test("halves a leading-dot length the same way as a zero-prefixed one", () => {
		expect(entryTranslate(slide({ from: "top", distance: ".5rem" }))).toBe("0 -.5rem");
		expect(styles(slide({ from: "top", distance: ".5rem" })).translate).toBe("0 -0.25rem");
	});

	test("rejects a non-length of thousands of digits in linear time", () => {
		let distance = `${"0".repeat(50_000)}!`;

		let started = performance.now();
		let mixin = slide({ from: "right", distance });

		expect(performance.now() - started).toBeLessThan(500);
		expect(entryTranslate(mixin)).toBe(`${distance} 0`);
		expect(styles(mixin).translate).toBe(`calc(${distance} / 2) 0`);
	});

	test("defaults to a transparent exit state alongside the offset", () => {
		let style = styles(slide({ from: "bottom" }));

		expect(style.opacity).toBe(0);
		expect(style.transitionProperty).toBe("opacity, translate, display, overlay");
	});
});
