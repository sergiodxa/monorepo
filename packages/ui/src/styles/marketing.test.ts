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
	test("defaults to the normal section-space token", () => {
		expect(styles(marketingSectionSpace())).toEqual({
			paddingBlock: "var(--ui-marketing-section-space, 6rem)",
		});
	});

	test("maps hero and compact onto their tokens", () => {
		expect(styles(marketingSectionSpace("hero")).paddingBlock).toBe(
			"var(--ui-marketing-section-space-hero, 8rem)",
		);
		expect(styles(marketingSectionSpace("compact")).paddingBlock).toBe(
			"var(--ui-marketing-section-space-compact, 4rem)",
		);
	});
});

describe("marketingBandTone", () => {
	test("plain leaves no paint", () => {
		expect(styles(marketingBandTone())).toEqual({});
		expect(styles(marketingBandTone("plain"))).toEqual({});
	});

	test("tinted paints a quiet neutral step with a brand corner glow", () => {
		let style = styles(marketingBandTone("tinted"));

		expect(style.backgroundColor).toBe("var(--ui-color-neutral-100)");
		expect(style.backgroundImage).toContain("var(--ui-brand-bg-solid)");
		expect(style[".dark &"]).toEqual({ backgroundColor: "var(--ui-color-neutral-900)" });
	});

	test("grid draws a faded absolute mesh behind the band", () => {
		let style = styles(marketingBandTone("grid"));

		expect(style.position).toBe("relative");
		expect(style["&::before"]).toMatchObject({
			content: '""',
			position: "absolute",
			opacity: "0.55",
		});
	});

	test("inverse uses the solid neutral surface and on-solid text", () => {
		expect(styles(marketingBandTone("inverse"))).toEqual({
			backgroundColor: "var(--ui-neutral-bg-solid)",
			color: "var(--ui-neutral-fg-on-solid)",
		});
	});
});

describe("displayHeading", () => {
	test("sets display family, weight, tracking and leading from marketing tokens", () => {
		let style = styles(displayHeading());

		expect(style.fontFamily).toBe("var(--ui-font-display, sans-serif)");
		expect(style.fontWeight).toBe("var(--ui-marketing-display-weight, 500)");
		expect(style.letterSpacing).toBe("var(--ui-marketing-display-tracking, -0.04em)");
		expect(style.lineHeight).toBe("var(--ui-marketing-display-leading, 1)");
		expect(style.fontSize).toBe("var(--ui-text-5xl, 3rem)");
		expect(style.textWrap).toBe("balance");
	});

	test("grows the page H1 at the lg container step", () => {
		expect(styles(displayHeading(1))["@container (min-width: 48rem)"]).toEqual({
			fontSize: "var(--ui-text-7xl, 4.5rem)",
		});
	});

	test("uses the chapter size token for level 2", () => {
		expect(styles(displayHeading(2)).fontSize).toBe("var(--ui-marketing-chapter-size, 2.75rem)");
	});
});

describe("marketingLead", () => {
	test("is muted lead-sized copy capped at the lead measure", () => {
		let style = styles(marketingLead());

		expect(style.fontSize).toBe("var(--ui-marketing-lead-size, 1.125rem)");
		expect(style.maxInlineSize).toBe("var(--ui-marketing-lead-measure, 40rem)");
		expect(style.color).toBe("var(--ui-neutral-fg-muted)");
		expect(style.textWrap).toBe("pretty");
	});
});

describe("marketingHairline", () => {
	test("is a 1px solid neutral rule on the block-start edge", () => {
		expect(styles(marketingHairline())).toEqual({
			borderBlockStartWidth: "1px",
			borderBlockStartStyle: "solid",
			borderBlockStartColor: "var(--ui-neutral-border)",
		});
	});
});

describe("logoCloudMark", () => {
	test("forces the logo height token and mutes the mark", () => {
		let style = styles(logoCloudMark());

		expect(style.blockSize).toBe("var(--ui-marketing-logo-height, 1rem)");
		expect(style.inlineSize).toBe("auto");
		expect(style.opacity).toBe(0.65);
		expect(style.objectFit).toBe("contain");
		expect(style.color).toBe("currentColor");
	});
});

describe("marketingCtaChrome", () => {
	test("applies the marketing CTA radius and a soft elevation", () => {
		let style = styles(marketingCtaChrome());

		expect(style.borderRadius).toBe("var(--ui-marketing-cta-radius, 0.5rem)");
		expect(style.boxShadow).toContain("0 1px 2px");
	});
});
