/**
 * Covers the enter/exit animation factories as pure `css()` output: the
 * `enterExit()` composer's selector defaults, `@starting-style`/reduced-motion
 * emission, and numeric-value stringification, plus the `fade()`/`zoom()`/
 * `slide()` presets delegating the right defaults through it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSMixinDescriptor } from "remix/ui";

import { describe, expect, test } from "vitest";

import { durations, easings } from "./tokens";
import { enterExit, fade, slide, zoom } from "./transitions";

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
		expect(style.transitionDuration).toBe(`${durations.normal}ms`);
		expect(style.transitionTimingFunction).toBe(easings.standard);
		expect(style.transitionBehavior).toBe("allow-discrete");
		expect(style[DEFAULT_SELECTOR]).toEqual({ opacity: 1 });
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

		expect(style[DEFAULT_SELECTOR]).toEqual({ opacity: 1, scale: "none", translate: "none" });
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

		expect(style["&[data-visible]"]).toEqual({ opacity: 1 });
		expect(style[DEFAULT_SELECTOR]).toBeUndefined();
	});

	test("a caller-provided duration and easing override the defaults", () => {
		let style = styles(enterExit({ opacity: 0, duration: 500, easing: easings.linear }));

		expect(style.transitionDuration).toBe("500ms");
		expect(style.transitionTimingFunction).toBe("linear");
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

		expect(style.transitionDuration).toBe(`${durations.fast}ms`);
		expect(style.transitionTimingFunction).toBe("linear");
		expect(style["&[data-open]"]).toEqual({ opacity: 1 });
	});
});

describe("zoom", () => {
	test("defaults to a transparent, slightly shrunk exit state", () => {
		let style = styles(zoom());

		expect(style.opacity).toBe(0);
		expect(style.scale).toBe("0.95");
		expect(style.transitionProperty).toBe("opacity, scale, display, overlay");
	});

	test("accepts a custom scale factor", () => {
		let style = styles(zoom({ scale: 0.8 }));

		expect(style.scale).toBe("0.8");
	});
});

describe("slide", () => {
	test("offsets the exit state away from the resting position for each edge", () => {
		expect(styles(slide({ from: "top" })).translate).toBe("0 -0.5rem");
		expect(styles(slide({ from: "bottom" })).translate).toBe("0 0.5rem");
		expect(styles(slide({ from: "left" })).translate).toBe("-0.5rem 0");
		expect(styles(slide({ from: "right" })).translate).toBe("0.5rem 0");
	});

	test("accepts a custom distance", () => {
		expect(styles(slide({ from: "top", distance: "1rem" })).translate).toBe("0 -1rem");
	});

	test("defaults to a transparent exit state alongside the offset", () => {
		let style = styles(slide({ from: "bottom" }));

		expect(style.opacity).toBe(0);
		expect(style.transitionProperty).toBe("opacity, translate, display, overlay");
	});
});
