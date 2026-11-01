/**
 * Covers the landing style factories as pure `css()` output: measure and
 * gutters, section spacing, band tones, display type, lead copy, hairlines,
 * and logo-cloud marks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor } from "remix/component";

import { describe, expect, test } from "vitest";

import {
	displayHeading,
	logoCloudMark,
	landingBandTone,
	landingContainer,
	landingCtaChrome,
	landingHairline,
	landingLead,
	landingSectionSpace,
} from "./landing.js";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("landingContainer", () => {
	test("caps the column at the landing measure and centers it", () => {
		let style = styles(landingContainer());

		expect(style.maxInlineSize).toBe("var(--ui-landing-measure, 72rem)");
		expect(style.marginInline).toBe("auto");
		expect(style.paddingInline).toBe("var(--ui-landing-gutter, 1rem)");
	});

	test("steps gutters through container queries at md and lg", () => {
		let style = styles(landingContainer());

		expect(style["@container (min-width: 36rem)"]).toEqual({ paddingInline: "1.5rem" });
		expect(style["@container (min-width: 48rem)"]).toEqual({ paddingInline: "2rem" });
	});
});

describe("landingSectionSpace", () => {
	test("defaults to the fluid normal section-space token", () => {
		expect(styles(landingSectionSpace())).toEqual({
			paddingBlock:
				"round(var(--ui-landing-section-space, clamp(5rem, 3.86rem + 4.85cqi, 7.5rem)), 1px)",
		});
	});

	test("maps hero, compact and cta onto their tokens, rounded to whole pixels", () => {
		expect(styles(landingSectionSpace("hero")).paddingBlock).toMatch(
			/^round\(var\(--ui-landing-section-space-hero, clamp\(3\.5rem, .+, 8rem\)\), 1px\)$/,
		);
		expect(styles(landingSectionSpace("compact")).paddingBlock).toMatch(
			/^round\(var\(--ui-landing-section-space-compact, clamp\(3rem, .+, 4\.5rem\)\), 1px\)$/,
		);
		expect(styles(landingSectionSpace("cta")).paddingBlock).toMatch(
			/^round\(var\(--ui-landing-section-space-cta, clamp\(5rem, .+, 7rem\)\), 1px\)$/,
		);
	});
});

describe("landingBandTone", () => {
	test("plain leaves no paint", () => {
		expect(styles(landingBandTone())).toEqual({});
		expect(styles(landingBandTone("plain"))).toEqual({});
	});

	test("tinted paints a quiet neutral step with a brand corner glow, lifted in dark", () => {
		let style = styles(landingBandTone("tinted"));

		expect(style.backgroundColor).toBe("var(--ui-landing-band-tint, var(--ui-color-neutral-100))");
		expect(style.backgroundImage).toContain("var(--ui-brand-bg-solid)");
		expect(style[".dark &"]).toEqual({
			backgroundColor: "var(--ui-landing-band-tint-dark, var(--ui-neutral-bg-tint))",
		});
	});

	test("grid draws a hairline mesh behind the band at full strength", () => {
		let style = styles(landingBandTone("grid"));
		let mesh = style["&::before"] as Record<string, unknown>;

		expect(style.position).toBe("relative");
		expect(mesh).toMatchObject({ content: '""', position: "absolute" });
		expect(mesh.backgroundImage).toContain("var(--ui-landing-hairline");
		expect(mesh.opacity).toBeUndefined();
	});

	test("inverse uses the solid neutral surface and on-solid text", () => {
		let style = styles(landingBandTone("inverse"));

		expect(style.backgroundColor).toBe("var(--ui-neutral-bg-solid)");
		expect(style.color).toBe("var(--ui-neutral-fg-on-solid)");
	});

	test("inverse re-points text, line, surface and focus tokens at the on-solid foreground", () => {
		let style = styles(landingBandTone("inverse"));

		expect(style["--ui-neutral-fg-emphasis"]).toBe("var(--ui-neutral-fg-on-solid)");
		expect(style["--ui-neutral-fg"]).toContain("var(--ui-neutral-fg-on-solid)");
		expect(style["--ui-neutral-fg-muted"]).toContain("var(--ui-neutral-fg-on-solid)");
		expect(style["--ui-neutral-border"]).toContain("var(--ui-neutral-fg-on-solid)");
		expect(style["--ui-landing-hairline"]).toContain("var(--ui-neutral-fg-on-solid)");
		expect(style["--ui-surface-raised"]).toContain("var(--ui-neutral-fg-on-solid)");
		expect(style["--ui-brand-ring"]).toBe("var(--ui-neutral-fg-on-solid)");
	});

	test("inverse becomes a raised surface on a dark page rather than a light slab", () => {
		let style = styles(landingBandTone("inverse"));
		let dark = style[".dark &"] as Record<string, unknown>;

		expect(dark.backgroundColor).toBe("var(--ui-surface-raised, Canvas)");
		expect(dark["--ui-neutral-fg-emphasis"]).toBe("inherit");
	});

	test("brand paints the 700 step and re-points tokens at its foreground", () => {
		let style = styles(landingBandTone("brand"));

		expect(style.backgroundColor).toBe("var(--ui-landing-brand-band, var(--ui-color-brand-700))");
		expect(style["--ui-neutral-fg-emphasis"]).toBe("var(--ui-brand-fg-on-solid)");
	});

	test("gradient paints whatever the page supplies", () => {
		expect(styles(landingBandTone("gradient")).backgroundImage).toBe(
			"var(--ui-landing-band-gradient, none)",
		);
	});
});

describe("displayHeading", () => {
	test("sizes the page H1 fluidly up to the display max, leading tied to size", () => {
		let style = styles(displayHeading());

		expect(style.fontFamily).toBe("var(--ui-font-display, sans-serif)");
		expect(style.fontWeight).toBe("var(--ui-landing-display-weight, 500)");
		expect(style.letterSpacing).toBe("var(--ui-landing-display-tracking, -0.035em)");
		expect(style.fontSize).toContain("var(--ui-landing-display-max, 4.5rem)");
		expect(style.lineHeight).toContain("var(--ui-landing-display-leading, min(");
	});

	test("sizes a chapter at two thirds of the headline at both ends of the clamp", () => {
		let h1 = String(styles(displayHeading(1)).fontSize);
		let h2 = String(styles(displayHeading(2)).fontSize);
		let min = (value: string) => Number(value.match(/clamp\(([\d.]+)rem/)?.[1]);

		expect(h2).toContain("var(--ui-landing-chapter-size, clamp(1.75rem");
		expect(min(h1) / min(h2)).toBe(1.5);
		expect(styles(displayHeading(2)).lineHeight).toBe("var(--ui-landing-chapter-leading, 1.1)");
		expect(styles(displayHeading(2)).letterSpacing).toBe(
			"var(--ui-landing-chapter-tracking, -0.025em)",
		);
	});
});

describe("landingLead", () => {
	test("is body-ink copy on a 2rem line, capped at the lead measure", () => {
		let style = styles(landingLead());

		expect(style.color).toBe("var(--ui-neutral-fg)");
		expect(style.fontSize).toBe("var(--ui-landing-lead-size, 1.125rem)");
		expect(style.lineHeight).toBe("var(--ui-landing-lead-leading, 2rem)");
		expect(style.fontWeight).toBe("var(--ui-landing-lead-weight, 400)");
		expect(style.maxInlineSize).toBe("var(--ui-landing-lead-measure, 40rem)");
	});

	test("draws emphasis fragments in the heading ink at the copy's weight", () => {
		let style = styles(landingLead());

		expect(style["& :is(strong, b, [data-emphasis])"]).toEqual({
			color: "var(--ui-neutral-fg-emphasis)",
			fontWeight: "inherit",
		});
	});

	test("steps up to the hero lead size", () => {
		expect(styles(landingLead("hero")).fontSize).toContain("var(--ui-landing-hero-lead-size");
		expect(styles(landingLead("hero")).lineHeight).toBe(
			"var(--ui-landing-hero-lead-leading, 1.55)",
		);
	});
});

describe("landingHairline", () => {
	test("is a 1px rule in the translucent hairline on the block-start edge", () => {
		expect(styles(landingHairline())).toEqual({
			borderBlockStartWidth: "1px",
			borderBlockStartStyle: "solid",
			borderBlockStartColor:
				"var(--ui-landing-hairline, color-mix(in oklch, CanvasText 8%, transparent))",
		});
	});
});

describe("logoCloudMark", () => {
	test("sizes the mark in full ink and steps it up at the lg container", () => {
		let style = styles(logoCloudMark());

		expect(style.blockSize).toBe("var(--ui-landing-logo-height, 1.75rem)");
		expect(style.opacity).toBeUndefined();
		expect(style["@container (min-width: 48rem)"]).toEqual({
			blockSize: "var(--ui-landing-logo-height-lg, 2.25rem)",
		});
	});
});

describe("landingCtaChrome", () => {
	test("hands the CTA radius and weight to the control through its own properties", () => {
		let style = styles(landingCtaChrome());

		expect(style["--ui-button-radius"]).toBe("var(--ui-landing-cta-radius, 0.5rem)");
		expect(style["--ui-button-weight"]).toBe("var(--ui-landing-cta-weight, 600)");
		expect(style.borderRadius).toBeUndefined();
		expect(style.boxShadow).toContain("var(--ui-shadow-control");
	});
});
