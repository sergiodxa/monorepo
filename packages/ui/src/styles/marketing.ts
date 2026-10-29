/**
 * Style-mixin factories for marketing / landing bands: content measure and
 * gutters, section spacing, band tones, display type, lead copy, hairlines,
 * and logo-cloud marks. Pair a band host with `viewReveal()` from the
 * animations entry so sections enter on scroll; reduced-motion is already
 * collapsed there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinDescriptor } from "remix/component";

import { bg, borderEdge, fg } from "@sdxc/u/color";
import { opacity } from "@sdxc/u/effects";
import { combine, raw, var as varUtility } from "@sdxc/u/general";
import { relative } from "@sdxc/u/layout";
import { at, dark } from "@sdxc/u/responsive";
import { bs, is, maxIs, mi, pi } from "@sdxc/u/size";
import { before } from "@sdxc/u/state";
import { balance, font, pretty } from "@sdxc/u/typography";

import type { CSSStyles } from "../utils/css-styles.js";

/** Max content width a marketing column settles at. */
const MEASURE = varUtility("ui-marketing-measure", "72rem");

/** Inline padding at the narrowest container step. */
const GUTTER = varUtility("ui-marketing-gutter", "1rem");

/** Block padding for a normal marketing band. */
const SECTION_SPACE = varUtility("ui-marketing-section-space", "6rem");

/** Block padding for a compact marketing band. */
const SECTION_SPACE_COMPACT = varUtility("ui-marketing-section-space-compact", "4rem");

/** Block padding for a hero marketing band. */
const SECTION_SPACE_HERO = varUtility("ui-marketing-section-space-hero", "8rem");

/** Letter-spacing for display headlines. */
const DISPLAY_TRACKING = varUtility("ui-marketing-display-tracking", "-0.04em");

/** Font weight for display headlines. */
const DISPLAY_WEIGHT = varUtility("ui-marketing-display-weight", "500");

/** Line-height for display headlines. */
const DISPLAY_LEADING = varUtility("ui-marketing-display-leading", "1");

/** Max width of supporting lead copy under a headline. */
const LEAD_MEASURE = varUtility("ui-marketing-lead-measure", "40rem");

/** Font size of supporting lead copy. */
const LEAD_SIZE = varUtility("ui-marketing-lead-size", "1.125rem");

/** Font size of a marketing section H2 (chapter). */
const CHAPTER_SIZE = varUtility("ui-marketing-chapter-size", "2.75rem");

/** Forced height of a logo-cloud mark. */
const LOGO_HEIGHT = varUtility("ui-marketing-logo-height", "1rem");

/** Default spacing step {@link marketingSectionSpace} applies. */
const DEFAULT_SECTION_SPACING = "normal" as const;

/** Default band fill {@link marketingBandTone} applies. */
const DEFAULT_BAND_TONE = "plain" as const;

/** Default outline depth {@link displayHeading} draws at. */
const DEFAULT_DISPLAY_LEVEL = 1 as const;

/**
 * How much block padding a marketing band leaves around its content.
 * `"hero"` is the first viewport, `"normal"` the repeating mid-page rhythm,
 * `"compact"` a tighter strip such as a proof row.
 */
export type MarketingSectionSpacing = "hero" | "normal" | "compact";

/**
 * What sits behind a marketing band: nothing, a quiet tint, a faded grid, or
 * an inverted solid for a closing call-to-action.
 */
export type MarketingBandTone = "plain" | "tinted" | "grid" | "inverse";

/**
 * Outline depth {@link displayHeading} sizes for: `1` is the page H1,
 * `2` a section chapter (~40–48px), `3` a quieter in-band title.
 */
export type MarketingDisplayLevel = 1 | 2 | 3;

/**
 * Centers a marketing content column at `--ui-marketing-measure` and pads
 * its inline edges from `--ui-marketing-gutter`, stepping 1rem → 1.5rem → 2rem
 * as the nearest container grows past `md` and `lg`.
 *
 * @returns A `css()` mixin ready for a content wrapper's `mix` prop.
 * @example
 * <div mix={[marketingContainer()]}>{children}</div>;
 */
export function marketingContainer<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return combine<Node>([
		maxIs<Node>(MEASURE),
		mi<Node>("auto"),
		pi<Node>(GUTTER),
		at<Node>("md", pi<Node>("1.5rem")),
		at<Node>("lg", pi<Node>("2rem")),
	]);
}

/**
 * Applies the band's block padding from the marketing section-space tokens.
 *
 * @param spacing Which of the three steps to apply. Defaults to `"normal"`.
 * @returns A `css()` mixin ready for a band host's `mix` prop.
 * @example
 * <section mix={[marketingSectionSpace("hero")]}>{children}</section>;
 */
export function marketingSectionSpace<Node extends Element = Element>(
	spacing: MarketingSectionSpacing = DEFAULT_SECTION_SPACING,
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	let padding = SECTION_SPACE;
	if (spacing === "hero") padding = SECTION_SPACE_HERO;
	if (spacing === "compact") padding = SECTION_SPACE_COMPACT;

	return raw<Node>({ paddingBlock: padding });
}

/**
 * The neutral text, border and tint tokens re-pointed at the solid fill's foreground, so
 * headings, leads and outlined controls inside an inverse band stay legible on it.
 */
const INVERSE_NEUTRAL_TOKENS = {
	"--ui-neutral-fg-emphasis": "var(--ui-neutral-fg-on-solid)",
	"--ui-neutral-fg": "color-mix(in oklch, var(--ui-neutral-fg-on-solid) 78%, transparent)",
	"--ui-neutral-fg-muted": "color-mix(in oklch, var(--ui-neutral-fg-on-solid) 64%, transparent)",
	"--ui-neutral-border": "color-mix(in oklch, var(--ui-neutral-fg-on-solid) 18%, transparent)",
	"--ui-neutral-bg-tint": "color-mix(in oklch, var(--ui-neutral-fg-on-solid) 6%, transparent)",
} as const;

/**
 * Paints a marketing band's background: a quiet neutral tint, a faded grid,
 * an inverted solid, or nothing for `"plain"`.
 *
 * @param tone Which fill to apply. Defaults to `"plain"`.
 * @returns A `css()` mixin ready for a band host's `mix` prop.
 * @example
 * <section mix={[marketingBandTone("tinted"), marketingSectionSpace()]}>{children}</section>;
 * @example
 * // Pair with viewReveal so the band enters as it scrolls into view:
 * // mix={[marketingBandTone("grid"), viewReveal()]}
 */
export function marketingBandTone<Node extends Element = Element>(
	tone: MarketingBandTone = DEFAULT_BAND_TONE,
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	switch (tone) {
		case "tinted":
			return combine<Node>([
				bg<Node>("color.neutral.100"),
				dark<Node>(bg<Node>("color.neutral.900")),
				raw<Node>({
					backgroundImage:
						"radial-gradient(60% 70% at 85% 0%, color-mix(in oklch, var(--ui-brand-bg-solid) 14%, transparent), transparent 70%)",
				}),
			]);
		case "grid":
			return combine<Node>([
				relative<Node>(),
				before<Node>(
					raw<Node>({
						content: '""',
						position: "absolute",
						inset: "0",
						zIndex: "-1",
						backgroundImage:
							"linear-gradient(to right, var(--ui-neutral-border) 1px, transparent 1px), linear-gradient(to bottom, var(--ui-neutral-border) 1px, transparent 1px)",
						backgroundSize: "3rem 3rem",
						opacity: "0.55",
						maskImage: "radial-gradient(70% 80% at 70% 40%, black, transparent 75%)",
						WebkitMaskImage: "radial-gradient(70% 80% at 70% 40%, black, transparent 75%)",
					}),
				),
			]);
		case "inverse":
			return combine<Node>([
				bg<Node>("neutral.solid"),
				fg<Node>("neutral.onSolid"),
				raw<Node>(INVERSE_NEUTRAL_TOKENS),
			]);
		default:
			return raw<Node>({});
	}
}

/**
 * Sets display typography for a marketing headline: the optional display
 * family, light weight, tight tracking, and near-1.0 leading from the
 * marketing tokens, with size stepping by outline depth.
 *
 * @param level Outline depth. Defaults to `1` (page H1).
 * @returns A `css()` mixin ready for a heading's `mix` prop.
 * @example
 * <h1 mix={[displayHeading()]}>{title}</h1>;
 * @example
 * <h2 mix={[displayHeading(2)]}>{chapter}</h2>;
 */
export function displayHeading<Node extends Element = Element>(
	level: MarketingDisplayLevel = DEFAULT_DISPLAY_LEVEL,
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	let size = varUtility("ui-text-xl", "1.25rem");
	if (level === 1) size = varUtility("ui-text-5xl", "3rem");
	if (level === 2) size = CHAPTER_SIZE;

	return combine<Node>([
		font<Node>("display"),
		fg<Node>("neutral.emphasis"),
		balance<Node>(),
		raw<Node>({
			fontWeight: DISPLAY_WEIGHT,
			letterSpacing: DISPLAY_TRACKING,
			lineHeight: DISPLAY_LEADING,
			fontSize: size,
			margin: "0",
		}),
		level === 1 ? at<Node>("lg", raw<Node>({ fontSize: varUtility("ui-text-7xl", "4.5rem") })) : [],
		level === 2 ? at<Node>("md", raw<Node>({ fontSize: varUtility("ui-text-5xl", "3rem") })) : [],
	]);
}

/**
 * Muted supporting copy under a marketing headline: lead size and measure,
 * pretty wrapping, and balanced lines.
 *
 * @returns A `css()` mixin ready for a lead paragraph's `mix` prop.
 * @example
 * <p mix={[marketingLead()]}>{description}</p>;
 */
export function marketingLead<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return combine<Node>([
		fg<Node>("neutral.muted"),
		pretty<Node>(),
		raw<Node>({
			fontSize: LEAD_SIZE,
			maxInlineSize: LEAD_MEASURE,
			lineHeight: "1.625",
			margin: "0",
		}),
	]);
}

/**
 * A low-contrast 1px rule along the block-start edge — the hairline a sticky
 * header, footer, or band uses to separate itself from what sits above.
 *
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <header mix={[marketingHairline()]}>{nav}</header>;
 */
export function marketingHairline<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return borderEdge<Node>("block-start", { color: "neutral", width: 1, style: "solid" });
}

/**
 * Forces a logo-cloud mark to `--ui-marketing-logo-height` with muted
 * currentColor treatment so adopter marks read as one quiet row.
 *
 * @returns A `css()` mixin ready for an `img` or inline SVG's `mix` prop.
 * @example
 * <img src={logo} alt="" mix={[logoCloudMark()]} />;
 */
export function logoCloudMark<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return combine<Node>([
		bs<Node>(LOGO_HEIGHT),
		is<Node>("auto"),
		opacity<Node>(65),
		raw<Node>({
			objectFit: "contain",
			color: "currentColor",
		}),
	]);
}

/** Soft elevation a solid marketing CTA carries over the band behind it. */
const CTA_SHADOW =
	"0 1px 2px color-mix(in oklab, CanvasText 6%, transparent), 0 4px 12px color-mix(in oklab, CanvasText 8%, transparent)";

/**
 * Corner radius and soft elevation for a solid marketing CTA. Compose onto a
 * {@link Button} or {@link LinkButton} in a hero {@link CtaGroup}; override
 * `--ui-marketing-cta-radius` per brand for pill (`9999px`) vs soft-rect.
 *
 * @returns A `css()` mixin ready for a CTA control's `mix` prop.
 * @example
 * <Button size="lg" color="brand" mix={[marketingCtaChrome()]}>{label}</Button>;
 */
export function marketingCtaChrome<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return raw<Node>({
		borderRadius: "var(--ui-marketing-cta-radius, 0.5rem)",
		boxShadow: CTA_SHADOW,
	});
}
