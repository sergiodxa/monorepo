/**
 * Covers the marketing style factories as pure `css()` output: measure and
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
	marketingBandTone,
	marketingContainer,
	marketingCtaChrome,
	marketingHairline,
	marketingLead,
	marketingSectionSpace,
} from "./marketing.js";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("marketingContainer", () => {
	test("caps the column at the marketing measure and centers it", () => {
		let style = styles(marketingContainer());

		expect(style.maxInlineSize).toBe("var(--ui-marketing-measure, 72rem)");
		expect(style.marginInline).toBe("auto");
		expect(style.paddingInline).toBe("var(--ui-marketing-gutter, 1rem)");
	});

	test("steps gutters through container queries at md and lg", () => {
		let style = styles(marketingContainer());

		expect(style["@container (min-width: 36rem)"]).toEqual({ paddingInline: "1.5rem" });
		expect(style["@container (min-width: 48rem)"]).toEqual({ paddingInline: "2rem" });
	});
});

describe("marketingSectionSpace", () => {
	test("defaults to the fluid normal section-space token", () => {
		expect(styles(marketingSectionSpace())).toEqual({
			paddingBlock:
				"round(var(--ui-marketing-section-space, clamp(5rem, 3.86rem + 4.85cqi, 7.5rem)), 1px)",
		});
	});

	test("maps hero, compact and cta onto their tokens, rounded to whole pixels", () => {
		expect(styles(marketingSectionSpace("hero")).paddingBlock).toMatch(
			/^round\(var\(--ui-marketing-section-space-hero, clamp\(3\.5rem, .+, 8rem\)\), 1px\)$/,
		);
		expect(styles(marketingSectionSpace("compact")).paddingBlock).toMatch(
			/^round\(var\(--ui-marketing-section-space-compact, clamp\(3rem, .+, 4\.5rem\)\), 1px\)$/,
		);
		expect(styles(marketingSectionSpace("cta")).paddingBlock).toMatch(
			/^round\(var\(--ui-marketing-section-space-cta, clamp\(5rem, .+, 7rem\)\), 1px\)$/,
		);
	});
});

describe("marketingBandTone", () => {
	test("plain leaves no paint", () => {
		expect(styles(marketingBandTone())).toEqual({});
		expect(styles(marketingBandTone("plain"))).toEqual({});
	});

	test("tinted paints a quiet neutral step with a brand corner glow, lifted in dark", () => {
		let style = styles(marketingBandTone("tinted"));

		expect(style.backgroundColor).toBe("var(--ui-color-neutral-100)");
		expect(style.backgroundImage).toContain("var(--ui-brand-bg-solid)");
		expect(style[".dark &"]).toEqual({ backgroundColor: "var(--ui-neutral-bg-tint)" });
	});

	test("grid draws a hairline mesh behind the band at full strength", () => {
		let style = styles(marketingBandTone("grid"));
		let mesh = style["&::before"] as Record<string, unknown>;

		expect(style.position).toBe("relative");
		expect(mesh).toMatchObject({ content: '""', position: "absolute" });
		expect(mesh.backgroundImage).toContain("var(--ui-marketing-hairline");
		expect(mesh.opacity).toBeUndefined();
	});

	test("inverse uses the solid neutral surface and on-solid text", () => {
		let style = styles(marketingBandTone("inverse"));

		expect(style.backgroundColor).toBe("var(--ui-neutral-bg-solid)");
		expect(style.color).toBe("var(--ui-neutral-fg-on-solid)");
	});

	test("inverse re-points text, line, surface and focus tokens at the on-solid foreground", () => {
		let style = styles(marketingBandTone("inverse"));

		expect(style["--ui-neutral-fg-emphasis"]).toBe("var(--ui-neutral-fg-on-solid)");
		expect(style["--ui-neutral-fg"]).toContain("var(--ui-neutral-fg-on-solid)");
		expect(style["--ui-neutral-fg-muted"]).toContain("var(--ui-neutral-fg-on-solid)");
		expect(style["--ui-neutral-border"]).toContain("var(--ui-neutral-fg-on-solid)");
		expect(style["--ui-marketing-hairline"]).toContain("var(--ui-neutral-fg-on-solid)");
		expect(style["--ui-surface-raised"]).toContain("var(--ui-neutral-fg-on-solid)");
		expect(style["--ui-brand-ring"]).toBe("var(--ui-neutral-fg-on-solid)");
	});

	test("inverse becomes a raised surface on a dark page rather than a light slab", () => {
		let style = styles(marketingBandTone("inverse"));
		let dark = style[".dark &"] as Record<string, unknown>;

		expect(dark.backgroundColor).toBe("var(--ui-surface-raised, Canvas)");
		expect(dark["--ui-neutral-fg-emphasis"]).toBe("inherit");
	});

	test("brand paints the 700 step and re-points tokens at its foreground", () => {
		let style = styles(marketingBandTone("brand"));

		expect(style.backgroundColor).toBe("var(--ui-marketing-brand-band, var(--ui-color-brand-700))");
		expect(style["--ui-neutral-fg-emphasis"]).toBe("var(--ui-brand-fg-on-solid)");
	});

	test("gradient paints whatever the page supplies", () => {
		expect(styles(marketingBandTone("gradient")).backgroundImage).toBe(
			"var(--ui-marketing-band-gradient, none)",
		);
	});
});

describe("displayHeading", () => {
	test("sizes the page H1 fluidly up to the display max, leading tied to size", () => {
		let style = styles(displayHeading());

		expect(style.fontFamily).toBe("var(--ui-font-display, sans-serif)");
		expect(style.fontWeight).toBe("var(--ui-marketing-display-weight, 500)");
		expect(style.letterSpacing).toBe("var(--ui-marketing-display-tracking, -0.035em)");
		expect(style.fontSize).toContain("var(--ui-marketing-display-max, 4.5rem)");
		expect(style.lineHeight).toContain("var(--ui-marketing-display-leading, min(");
	});

	test("sizes a chapter at two thirds of the headline at both ends of the clamp", () => {
		let h1 = String(styles(displayHeading(1)).fontSize);
		let h2 = String(styles(displayHeading(2)).fontSize);
		let min = (value: string) => Number(value.match(/clamp\(([\d.]+)rem/)?.[1]);

		expect(h2).toContain("var(--ui-marketing-chapter-size, clamp(1.75rem");
		expect(min(h1) / min(h2)).toBe(1.5);
		expect(styles(displayHeading(2)).lineHeight).toBe("var(--ui-marketing-chapter-leading, 1.1)");
		expect(styles(displayHeading(2)).letterSpacing).toBe(
			"var(--ui-marketing-chapter-tracking, -0.025em)",
		);
	});
});

describe("marketingLead", () => {
	test("is body-ink copy on a 2rem line, capped at the lead measure", () => {
		let style = styles(marketingLead());

		expect(style.color).toBe("var(--ui-neutral-fg)");
		expect(style.fontSize).toBe("var(--ui-marketing-lead-size, 1.125rem)");
		expect(style.lineHeight).toBe("var(--ui-marketing-lead-leading, 2rem)");
		expect(style.fontWeight).toBe("var(--ui-marketing-lead-weight, 400)");
		expect(style.maxInlineSize).toBe("var(--ui-marketing-lead-measure, 40rem)");
	});

	test("draws emphasis fragments in the heading ink at the copy's weight", () => {
		let style = styles(marketingLead());

		expect(style["& :is(strong, b, [data-emphasis])"]).toEqual({
			color: "var(--ui-neutral-fg-emphasis)",
			fontWeight: "inherit",
		});
	});

	test("steps up to the hero lead size", () => {
		expect(styles(marketingLead("hero")).fontSize).toContain("var(--ui-marketing-hero-lead-size");
		expect(styles(marketingLead("hero")).lineHeight).toBe(
			"var(--ui-marketing-hero-lead-leading, 1.55)",
		);
	});
});

describe("marketingHairline", () => {
	test("is a 1px rule in the translucent hairline on the block-start edge", () => {
		expect(styles(marketingHairline())).toEqual({
			borderBlockStartWidth: "1px",
			borderBlockStartStyle: "solid",
			borderBlockStartColor:
				"var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))",
		});
	});
});

describe("logoCloudMark", () => {
	test("sizes the mark in full ink and steps it up at the lg container", () => {
		let style = styles(logoCloudMark());

		expect(style.blockSize).toBe("var(--ui-marketing-logo-height, 1.75rem)");
		expect(style.opacity).toBeUndefined();
		expect(style["@container (min-width: 48rem)"]).toEqual({
			blockSize: "var(--ui-marketing-logo-height-lg, 2.25rem)",
		});
	});
});

describe("marketingCtaChrome", () => {
	test("hands the CTA radius and weight to the control through its own properties", () => {
		let style = styles(marketingCtaChrome());

		expect(style["--ui-button-radius"]).toBe("var(--ui-marketing-cta-radius, 0.5rem)");
		expect(style["--ui-button-weight"]).toBe("var(--ui-marketing-cta-weight, 600)");
		expect(style.borderRadius).toBeUndefined();
		expect(style.boxShadow).toContain("var(--ui-shadow-control");
	});
});
