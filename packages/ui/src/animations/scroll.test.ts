/**
 * Unit tests for the scroll-driven animation factories in {@link "./scroll"}.
 * Each factory returns a `css()` mixin descriptor whose `args[0]` is the raw
 * style object passed to `css()`, so assertions read that object directly —
 * no DOM, frame runtime, or stylesheet insertion is involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor } from "remix/ui";

import { describe, expect, test } from "vitest";

import { scrollProgress, scrollShadow, viewReveal } from "./scroll";

const SUPPORTS_SCROLL_TIMELINE = "@supports (animation-timeline: scroll())";
const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

/** Narrows a mixin descriptor's stored `css()` argument to a plain record for indexing in assertions. */
function stylesOf(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as unknown as Record<string, unknown>;
}

/** Reads the object nested under the `@supports (animation-timeline: scroll())` key. */
function supportedRules(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return stylesOf(descriptor)[SUPPORTS_SCROLL_TIMELINE] as Record<string, unknown>;
}

/** Reads a rule's value as the string it must be, so a missing or nested rule fails loudly instead of interpolating as `undefined`. */
function stringRule(rules: Record<string, unknown>, name: string): string {
	let value = rules[name];

	if (typeof value !== "string") {
		throw new Error(`Expected rule "${name}" to hold a string, found ${typeof value}.`);
	}

	return value;
}

describe(scrollShadow.name, () => {
	test("wraps its rules in a scroll-timeline @supports guard", () => {
		let rules = stylesOf(scrollShadow());

		expect(Object.keys(rules)).toEqual([SUPPORTS_SCROLL_TIMELINE]);
	});

	test("defaults to a 120px ramp tied to the nearest block-axis scroller", () => {
		let rules = supportedRules(scrollShadow());

		expect(rules.animationTimeline).toBe("scroll(nearest block)");
		expect(rules.animationRange).toBe("0 120px");
		expect(rules.animationFillMode).toBe("both");
	});

	test("distance overrides the ramp length", () => {
		let rules = supportedRules(scrollShadow({ distance: "80px" }));

		expect(rules.animationRange).toBe("0 80px");
	});

	test("emits keyframes from a transparent shadow to the themed shadow variable", () => {
		let rules = supportedRules(scrollShadow());
		let keyframesKey = `@keyframes ${stringRule(rules, "animationName")}`;
		let keyframes = rules[keyframesKey] as {
			from: { boxShadow: string };
			to: { boxShadow: string };
		};

		expect(keyframes.from.boxShadow).toBe("0 0 0 0 transparent");
		expect(keyframes.to.boxShadow).toContain("var(--ui-scroll-shadow");
	});

	test("reduced motion disables the scroll-linked animation and settles on the resting shadow", () => {
		let rules = supportedRules(scrollShadow());
		let reduced = rules[REDUCED_MOTION] as { animationName: string; boxShadow: string };

		expect(reduced.animationName).toBe("none");
		expect(reduced.boxShadow).toContain("var(--ui-scroll-shadow");
	});
});

describe(scrollProgress.name, () => {
	test("defaults to tracking the nearest block-axis scroller", () => {
		let rules = supportedRules(scrollProgress());

		expect(rules.animationTimeline).toBe("scroll(nearest block)");
	});

	test("axis selects the tracked scroll dimension", () => {
		let rules = supportedRules(scrollProgress({ axis: "inline" }));

		expect(rules.animationTimeline).toBe("scroll(nearest inline)");
	});

	test("grows inline-size from empty to full", () => {
		let rules = supportedRules(scrollProgress());
		let keyframesKey = `@keyframes ${stringRule(rules, "animationName")}`;
		let keyframes = rules[keyframesKey] as {
			from: { inlineSize: string };
			to: { inlineSize: string };
		};

		expect(keyframes.from.inlineSize).toBe("0%");
		expect(keyframes.to.inlineSize).toBe("100%");
	});

	test("reduced motion pins the fill at full size and fades opacity instead of growing", () => {
		let rules = supportedRules(scrollProgress());
		let reduced = rules[REDUCED_MOTION] as Record<string, unknown>;

		expect(reduced.inlineSize).toBe("100%");
		expect(reduced.animationName).not.toBe(rules.animationName);

		let keyframesKey = `@keyframes ${stringRule(reduced, "animationName")}`;
		let keyframes = reduced[keyframesKey] as { from: { opacity: number }; to: { opacity: number } };

		expect(keyframes.from.opacity).toBe(0);
		expect(keyframes.to.opacity).toBe(1);
	});
});

describe(viewReveal.name, () => {
	test("defaults to rising in from the block-end edge along the block scroll axis", () => {
		let rules = supportedRules(viewReveal());

		expect(rules.animationTimeline).toBe("view(block)");
		expect(rules.animationRange).toBe("entry");
		expect(rules["--ui-view-reveal-translate"]).toBe("0 1.5rem");
		expect(rules["&:dir(rtl)"]).toBeUndefined();
	});

	test("distance scales the translate offset", () => {
		let rules = supportedRules(viewReveal({ from: "block-start", distance: "3rem" }));

		expect(rules["--ui-view-reveal-translate"]).toBe("0 calc(-1 * 3rem)");
	});

	test("axis selects the view-timeline scroll dimension", () => {
		let rules = supportedRules(viewReveal({ axis: "inline" }));

		expect(rules.animationTimeline).toBe("view(inline)");
	});

	test("none translates nowhere and only fades in", () => {
		let rules = supportedRules(viewReveal({ from: "none" }));

		expect(rules["--ui-view-reveal-translate"]).toBe("0 0");
		expect(rules["&:dir(rtl)"]).toBeUndefined();
	});

	test("inline-start mirrors its translate under :dir(rtl)", () => {
		let rules = supportedRules(viewReveal({ from: "inline-start", distance: "2rem" }));
		let rtl = rules["&:dir(rtl)"] as Record<string, unknown>;

		expect(rules["--ui-view-reveal-translate"]).toBe("calc(-1 * 2rem) 0");
		expect(rtl["--ui-view-reveal-translate"]).toBe("2rem 0");
	});

	test("inline-end mirrors the opposite way", () => {
		let rules = supportedRules(viewReveal({ from: "inline-end", distance: "2rem" }));
		let rtl = rules["&:dir(rtl)"] as Record<string, unknown>;

		expect(rules["--ui-view-reveal-translate"]).toBe("2rem 0");
		expect(rtl["--ui-view-reveal-translate"]).toBe("calc(-1 * 2rem) 0");
	});

	test("every configuration shares the same @keyframes names", () => {
		let a = supportedRules(viewReveal({ from: "block-start" }));
		let b = supportedRules(viewReveal({ from: "inline-end", distance: "5rem" }));

		expect(a.animationName).toBe(b.animationName);
	});

	test("reduced motion collapses the translate to opacity-only", () => {
		let rules = supportedRules(viewReveal());
		let reduced = rules[REDUCED_MOTION] as { animationName: string; translate: string };

		expect(reduced.translate).toBe("0 0");
		expect(reduced.animationName).not.toBe(rules.animationName);
	});
});
