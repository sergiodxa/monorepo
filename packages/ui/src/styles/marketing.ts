/**
 * Style-mixin factories for marketing / landing bands: content measure and
 * gutters, fluid section spacing, band tones, display type, lead copy,
 * hairlines, raised surfaces, eyebrows, CTA chrome and logo-cloud marks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UtilityMixin } from "@sdxc/u";
import type { ElementProps, MixinDescriptor } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { bg, fg } from "@sdxc/u/color";
import { combine, raw, var as varUtility } from "@sdxc/u/general";
import { inlineFlex, items, relative } from "@sdxc/u/layout";
import { at, dark, motionSafe } from "@sdxc/u/responsive";
import { bs, is, maxIs, mi, pb, pi } from "@sdxc/u/size";
import { before, when } from "@sdxc/u/state";
import { balance, font, pretty, text, weight } from "@sdxc/u/typography";

import type { CSSStyles } from "../utils/css-styles.js";

/** Max content width a marketing column settles at. */
const MEASURE = varUtility("ui-marketing-measure", "72rem");

/** Inline padding at the narrowest container step. */
const GUTTER = varUtility("ui-marketing-gutter", "1rem");

/** Block padding for a normal band: 5rem on a phone, 7.5rem from a ~1200px band up. */
const SECTION_SPACE = varUtility(
	"ui-marketing-section-space",
	"clamp(5rem, 3.86rem + 4.85cqi, 7.5rem)",
);

/** Block padding for a compact band: 3rem on a phone, 4.5rem wide. */
const SECTION_SPACE_COMPACT = varUtility(
	"ui-marketing-section-space-compact",
	"clamp(3rem, 2.32rem + 2.91cqi, 4.5rem)",
);

/** Block padding for a hero band, measured from the header: 3.5rem on a phone, 8rem wide. */
const SECTION_SPACE_HERO = varUtility(
	"ui-marketing-section-space-hero",
	"clamp(3.5rem, 1.45rem + 8.73cqi, 8rem)",
);

/** Block padding for a closing call-to-action band: 5rem on a phone, 7rem wide. */
const SECTION_SPACE_CTA = varUtility(
	"ui-marketing-section-space-cta",
	"clamp(5rem, 4.09rem + 3.88cqi, 7rem)",
);

/** Letter-spacing for the page headline. */
const DISPLAY_TRACKING = varUtility("ui-marketing-display-tracking", "-0.035em");

/** Font weight for display and chapter headlines. */
const DISPLAY_WEIGHT = varUtility("ui-marketing-display-weight", "500");

/**
 * Page headline size: 42px on a phone, rising with the band to 72px, or to
 * `--ui-marketing-display-max` (up to 8rem) where a page opts into a larger top step.
 */
const DISPLAY_SIZE = varUtility(
	"ui-marketing-display-size",
	"clamp(2.625rem, 1.77rem + 3.64cqi, var(--ui-marketing-display-max, 4.5rem))",
);

/**
 * Page headline leading tied to its size: 1.1 at 40px, 1.0 at 72px and 0.9 from 96px up,
 * so a two-line display never collides and a short one never floats apart.
 */
const DISPLAY_LEADING = varUtility(
	"ui-marketing-display-leading",
	"min(calc(0.875em + 0.5625rem), calc(0.6em + 1.8rem))",
);

/** Chapter (band H2) size: 28px on a phone, 48px wide, two thirds of the headline. */
const CHAPTER_SIZE = varUtility(
	"ui-marketing-chapter-size",
	"clamp(1.75rem, 1.18rem + 2.42cqi, 3rem)",
);

/** Chapter leading. */
const CHAPTER_LEADING = varUtility("ui-marketing-chapter-leading", "1.1");

/** Chapter letter-spacing. */
const CHAPTER_TRACKING = varUtility("ui-marketing-chapter-tracking", "-0.025em");

/** Max width of supporting lead copy under a headline. */
const LEAD_MEASURE = varUtility("ui-marketing-lead-measure", "40rem");

/** Font size of supporting lead copy. */
const LEAD_SIZE = varUtility("ui-marketing-lead-size", "1.125rem");

/** Font size of the hero's lead: 17px on a phone, 20px wide, as the reference landings set it. */
const HERO_LEAD_SIZE = varUtility(
	"ui-marketing-hero-lead-size",
	"clamp(1.0625rem, 0.98rem + 0.4cqi, 1.25rem)",
);

/** Line height of the hero's lead, proportional so it tracks the fluid size: 26px to 31px. */
const HERO_LEAD_LEADING = varUtility("ui-marketing-hero-lead-leading", "1.55");

/** Line height of lead copy, held at 2rem as every reference template does. */
const LEAD_LEADING = varUtility("ui-marketing-lead-leading", "2rem");

/** Font weight of lead copy; a display-led brand sets 500. */
const LEAD_WEIGHT = varUtility("ui-marketing-lead-weight", "400");

/** Height of a logo-cloud mark at the narrowest step. */
const LOGO_HEIGHT = varUtility("ui-marketing-logo-height", "1.75rem");

/** Height of a logo-cloud mark from the `lg` container up. */
const LOGO_HEIGHT_LG = varUtility("ui-marketing-logo-height-lg", "2.25rem");

/** Translucent line every marketing edge, rule and grid draws with. */
const HAIRLINE = varUtility(
	"ui-marketing-hairline",
	"color-mix(in oklch, CanvasText 8%, transparent)",
);

/** Fill of a surface that sits above the band: frames, cards, code. */
const SURFACE_RAISED = varUtility("ui-surface-raised", "Canvas");

/** Corner radius of a staged surface. */
const RADIUS_SURFACE = varUtility("ui-marketing-radius-surface", "1rem");

/** Edge a raised surface draws: a ring plus a small drop, or a top-lit hairline in dark. */
const SHADOW_SURFACE = varUtility("ui-shadow-surface", "0 0 0 1px rgb(0 0 0 / 0.06)");

/** Default spacing step {@link marketingSectionSpace} applies. */
const DEFAULT_SECTION_SPACING = "normal" as const;

/** Default band fill {@link marketingBandTone} applies. */
const DEFAULT_BAND_TONE = "plain" as const;

/** Default outline depth {@link displayHeading} draws at. */
const DEFAULT_DISPLAY_LEVEL = 1 as const;

/** Default step {@link marketingLead} sizes for. */
const DEFAULT_LEAD_STEP = "band" as const;

/** Default look {@link eyebrow} draws. */
const DEFAULT_EYEBROW_VARIANT = "mono" as const;

/** Name of the keyframes {@link marketingSlowSpin} turns through. */
const SLOW_SPIN_KEYFRAMES = "ui-marketing-slow-spin";

/**
 * How much block padding a marketing band leaves around its content.
 * `"hero"` is the first viewport, `"normal"` the repeating mid-page rhythm,
 * `"compact"` a tighter strip such as a proof row, `"cta"` a closing band.
 */
export type MarketingSectionSpacing = "hero" | "normal" | "compact" | "cta";

/**
 * What sits behind a marketing band: nothing, a quiet tint, a faded grid, an
 * inverted solid, the brand solid, or a gradient the page supplies through
 * `--ui-marketing-band-gradient`.
 */
export type MarketingBandTone = "plain" | "tinted" | "grid" | "inverse" | "brand" | "gradient";

/**
 * Outline depth {@link displayHeading} sizes for: `1` is the page H1,
 * `2` a section chapter, `3` a quieter in-band title.
 */
export type MarketingDisplayLevel = 1 | 2 | 3;

/** Which lead {@link marketingLead} sizes: a band's, or the larger hero step. */
export type MarketingLeadStep = "band" | "hero";

/**
 * How an eyebrow reads: `mono` a quiet uppercase label for section headers,
 * `quiet` a hairline pill for hero announcements, `soft` a filled muted pill,
 * `pill` the brand pill, `numbered` a brand-ringed pill led by its index.
 */
export type MarketingEyebrowVariant = "mono" | "quiet" | "soft" | "pill" | "numbered";

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
 * Re-declares the surface tokens that derive from the neutral palette on the element that
 * scopes its own `--ui-color-neutral-*` scale, so raised cards, frames and hairlines inside
 * take that palette's hue in light and dark instead of the page root's.
 *
 * @returns A `css()` mixin for the element that overrides a palette scale.
 * @example
 * <div style="--ui-color-neutral-950: oklch(0.165 0.006 55)" mix={[themeScope()]}>{page}</div>;
 */
export function themeScope<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return combine<Node>([
		raw<Node>({
			"--ui-marketing-hairline":
				"color-mix(in oklch, var(--ui-neutral-fg-emphasis) 6%, transparent)",
		}),
		dark<Node>(
			raw<Node>({
				"--ui-surface-raised":
					"color-mix(in oklch, var(--ui-color-neutral-950), var(--ui-color-neutral-900))",
				"--ui-marketing-hairline": "color-mix(in oklch, white 10%, transparent)",
			}),
		),
	]);
}

/**
 * Applies the band's block padding from the marketing section-space tokens. Each
 * step is fluid in the width of the container around the band, so a phone gets
 * the tighter end and a desktop band the generous one without a breakpoint jump.
 * The step rounds to whole pixels, so band hairlines and edges stay crisp.
 *
 * @param spacing Which step to apply. Defaults to `"normal"`.
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
	if (spacing === "cta") padding = SECTION_SPACE_CTA;

	return raw<Node>({ paddingBlock: `round(${padding}, 1px)` });
}

/**
 * The neutral text, line, surface and focus tokens re-pointed at a solid fill's
 * foreground, so headings, leads, hairlines, raised controls and focus rings inside an
 * inverse or brand band stay legible on it: leads and labels keep at least 4.5:1 on the
 * band's fill.
 */
function onSolidTokens(onSolid: string): CSSStyles {
	return {
		"--ui-neutral-fg-emphasis": onSolid,
		"--ui-neutral-fg": `color-mix(in oklch, ${onSolid} 92%, transparent)`,
		"--ui-neutral-fg-muted": `color-mix(in oklch, ${onSolid} 78%, transparent)`,
		"--ui-marketing-eyebrow-color": `color-mix(in oklch, ${onSolid} 78%, transparent)`,
		"--ui-neutral-border": `color-mix(in oklch, ${onSolid} 18%, transparent)`,
		"--ui-neutral-bg-tint": `color-mix(in oklch, ${onSolid} 6%, transparent)`,
		"--ui-marketing-hairline": `color-mix(in oklch, ${onSolid} 12%, transparent)`,
		"--ui-surface-raised": `color-mix(in oklch, ${onSolid} 12%, transparent)`,
		"--ui-shadow-surface": `inset 0 0 0 1px color-mix(in oklch, ${onSolid} 14%, transparent)`,
		"--ui-shadow-control": `inset 0 0 0 1px color-mix(in oklch, ${onSolid} 16%, transparent)`,
		"--ui-brand-ring": onSolid,
		"--ui-neutral-ring": onSolid,
	};
}

/**
 * Marks every declaration `!important`. A dark theme re-declares the text tokens on each
 * element, so a brand band asserts its own over its whole subtree to keep them in dark.
 */
function important(styles: CSSStyles): CSSStyles {
	return Object.fromEntries(
		Object.entries(styles).map(([property, value]) => [
			property,
			typeof value === "string" ? `${value} !important` : value,
		]),
	) as CSSStyles;
}

/**
 * The tokens a dark page's inverse band restores: rather than painting a near-white slab
 * at the foot of a dark page, the band becomes a raised surface carrying the page's own
 * text and line tokens.
 */
const DARK_INVERSE_TOKENS = {
	"--ui-neutral-fg-emphasis": "inherit",
	"--ui-neutral-fg": "inherit",
	"--ui-neutral-fg-muted": "inherit",
	"--ui-marketing-eyebrow-color": "inherit",
	"--ui-neutral-border": "inherit",
	"--ui-neutral-bg-tint": "inherit",
	"--ui-marketing-hairline": "inherit",
	"--ui-surface-raised": "inherit",
	"--ui-shadow-surface": "inherit",
	"--ui-shadow-control": "inherit",
	"--ui-brand-ring": "inherit",
	"--ui-neutral-ring": "inherit",
} as const;

/**
 * The brand band's fill: the 700 step, one deeper than a brand button, so white leads and
 * labels on it clear 4.5:1 for any 600 step a palette picks. Override with
 * `--ui-marketing-brand-band`.
 */
const BRAND_BAND_FILL = "var(--ui-marketing-brand-band, var(--ui-color-brand-700))";

/** The quiet brand glow a tinted or dark-inverse band carries in its top corner. */
const BRAND_GLOW =
	"radial-gradient(60% 70% at 85% 0%, color-mix(in oklch, var(--ui-brand-bg-solid) 14%, transparent), transparent 70%)";

/**
 * Paints a marketing band's background: a quiet neutral tint (`--ui-marketing-band-tint`,
 * `-tint-dark`, and `--ui-marketing-band-glow`, `none` to drop it), a hairline grid, an
 * inverted solid, the brand solid, a page-supplied gradient, or nothing for `"plain"`.
 * Inverse and brand bands re-point the neutral tokens at the fill's foreground; on a
 * dark page an inverse band renders as a raised surface with hairlines and the glow.
 *
 * @param tone Which fill to apply. Defaults to `"plain"`.
 * @returns A `css()` mixin ready for a band host's `mix` prop.
 * @example
 * <section mix={[marketingBandTone("tinted"), marketingSectionSpace()]}>{children}</section>;
 * @example
 * <section mix={[marketingBandTone("brand")]} style="--ui-marketing-band-gradient: …">…</section>;
 */
export function marketingBandTone<Node extends Element = Element>(
	tone: MarketingBandTone = DEFAULT_BAND_TONE,
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	switch (tone) {
		case "tinted":
			return combine<Node>([
				raw<Node>({
					backgroundColor: "var(--ui-marketing-band-tint, var(--ui-color-neutral-100))",
					backgroundImage: `var(--ui-marketing-band-glow, ${BRAND_GLOW})`,
				}),
				dark<Node>(
					raw<Node>({
						backgroundColor: "var(--ui-marketing-band-tint-dark, var(--ui-neutral-bg-tint))",
					}),
				),
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
						backgroundImage: `linear-gradient(to right, ${HAIRLINE} 1px, transparent 1px), linear-gradient(to bottom, ${HAIRLINE} 1px, transparent 1px)`,
						backgroundSize: "3rem 3rem",
						maskImage: "radial-gradient(70% 80% at 70% 40%, black, transparent 75%)",
						WebkitMaskImage: "radial-gradient(70% 80% at 70% 40%, black, transparent 75%)",
					}),
				),
			]);
		case "inverse":
			return combine<Node>([
				bg<Node>("neutral.solid"),
				fg<Node>("neutral.onSolid"),
				raw<Node>(onSolidTokens("var(--ui-neutral-fg-on-solid)")),
				dark<Node>(
					raw<Node>({
						...DARK_INVERSE_TOKENS,
						backgroundColor: SURFACE_RAISED,
						backgroundImage: BRAND_GLOW,
						color: "var(--ui-neutral-fg-emphasis)",
						boxShadow: `inset 0 1px 0 ${HAIRLINE}, inset 0 -1px 0 ${HAIRLINE}`,
					}),
				),
			]);
		case "brand":
			return combine<Node>([
				raw<Node>({ backgroundColor: BRAND_BAND_FILL }),
				fg<Node>("brand.onSolid"),
				raw<Node>(onSolidTokens("var(--ui-brand-fg-on-solid)")),
				dark<Node>(
					when<Node>("&, & *", raw<Node>(important(onSolidTokens("var(--ui-brand-fg-on-solid)")))),
				),
			]);
		case "gradient":
			return raw<Node>({
				backgroundImage: "var(--ui-marketing-band-gradient, none)",
				backgroundColor: "var(--ui-marketing-band-gradient-base, transparent)",
			});
		default:
			return raw<Node>({});
	}
}

/**
 * Sets display typography for a marketing headline. Level 1 is the page H1, sized
 * fluidly from 42px to 72px (or `--ui-marketing-display-max`) with leading that tightens
 * as it grows; level 2 is the band chapter at two thirds of that, so the H1:H2 ratio
 * holds at 1.5:1 at every width. Sizes read `cqi`, so a headline in a narrow column steps
 * down on its own.
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
	let leading = CHAPTER_LEADING;
	let tracking = CHAPTER_TRACKING;
	if (level === 1) {
		size = DISPLAY_SIZE;
		leading = DISPLAY_LEADING;
		tracking = DISPLAY_TRACKING;
	}
	if (level === 2) size = CHAPTER_SIZE;

	return combine<Node>([
		font<Node>("display"),
		fg<Node>("neutral.emphasis"),
		balance<Node>(),
		raw<Node>({
			fontWeight: DISPLAY_WEIGHT,
			letterSpacing: tracking,
			lineHeight: leading,
			fontSize: size,
		}),
	]);
}

/**
 * Draws `strong`, `b` and `[data-emphasis]` inside supporting copy in the emphasis ink at
 * the copy's own weight, so a key phrase gives the scanning eye a second level without
 * turning bold.
 *
 * @returns A `css()` mixin ready for a lead, description or body's `mix` prop.
 * @example
 * <p mix={[marketingEmphasis()]}>Ship <strong>one worker</strong> per app.</p>;
 */
export function marketingEmphasis<Node extends Element = Element>(): UtilityMixin<Node> {
	return when<Node>(
		"& :is(strong, b, [data-emphasis])",
		raw<Node>({ color: "var(--ui-neutral-fg-emphasis)", fontWeight: "inherit" }),
	);
}

/**
 * Supporting copy under a marketing headline, in the body ink so it reads at 4.5:1 or
 * better on the band, on a 2rem line, with emphasis fragments in the heading ink.
 *
 * @param step `"hero"` for the larger first-viewport lead. Defaults to `"band"`.
 * @returns A `css()` mixin ready for a lead paragraph's `mix` prop.
 * @example
 * <p mix={[marketingLead()]}>{description}</p>;
 * @example
 * <p mix={[marketingLead("hero")]}>{description}</p>;
 */
export function marketingLead<Node extends Element = Element>(
	step: MarketingLeadStep = DEFAULT_LEAD_STEP,
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	return combine<Node>([
		fg<Node>("neutral"),
		pretty<Node>(),
		raw<Node>({
			fontSize: step === "hero" ? HERO_LEAD_SIZE : LEAD_SIZE,
			fontWeight: LEAD_WEIGHT,
			maxInlineSize: LEAD_MEASURE,
			lineHeight: step === "hero" ? HERO_LEAD_LEADING : LEAD_LEADING,
		}),
		marketingEmphasis<Node>(),
	]);
}

/**
 * A translucent 1px rule along the block-start edge — the hairline a sticky header,
 * footer, or band uses to separate itself from what sits above. It takes the tone of
 * whatever is behind it, and high contrast promotes it to the strong border.
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
	return raw<Node>({
		borderBlockStartWidth: "1px",
		borderBlockStartStyle: "solid",
		borderBlockStartColor: HAIRLINE,
	});
}

/**
 * A surface raised above the band — a frame, card or code sheet: the raised fill, the
 * surface radius and the surface edge, which is a ring and a small drop in light and a
 * top-lit hairline in dark. Drawn as a shadow, so the edge never changes the box size.
 *
 * @returns A `css()` mixin ready for a surface's `mix` prop.
 * @example
 * <div mix={[marketingSurface()]}>{card}</div>;
 */
export function marketingSurface<Node extends Element = Element>(): UtilityMixin<Node> {
	return combine<Node>([
		raw<Node>({
			backgroundColor: SURFACE_RAISED,
			borderRadius: RADIUS_SURFACE,
			boxShadow: SHADOW_SURFACE,
		}),
	]);
}

/**
 * Sizes a logo-cloud mark at `--ui-marketing-logo-height` (1.75rem, 2.25rem from the
 * `lg` container) in full ink, so adopter marks read at the size a visitor recognizes
 * them. Dimming belongs to the cloud, never to the mark.
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
		raw<Node>({ objectFit: "contain", color: "currentColor" }),
		at<Node>("lg", bs<Node>(LOGO_HEIGHT_LG)),
	]);
}

/**
 * Corner radius, weight and tactile edge for a marketing CTA. Compose onto a
 * {@link Button} or {@link LinkButton}; it sets `--ui-button-radius` and
 * `--ui-button-weight`, which the control reads, so `--ui-marketing-cta-radius` (pill,
 * 8px, 6px) applies whatever order the stylesheets load in; `--ui-marketing-cta-height`
 * raises every CTA to one height. Only colour and shadow
 * animate, so a hover never eases the control's size or radius.
 *
 * @returns A `css()` mixin ready for a CTA control's `mix` prop.
 * @example
 * <Button color="brand" mix={[marketingCtaChrome()]}>{label}</Button>;
 */
export function marketingCtaChrome<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return raw<Node>({
		"--ui-button-radius": "var(--ui-marketing-cta-radius, 0.5rem)",
		"--ui-button-weight": "var(--ui-marketing-cta-weight, 600)",
		boxShadow: "var(--ui-shadow-control, 0 1px 2px rgb(0 0 0 / 0.05))",
		blockSize: "var(--ui-marketing-cta-height, auto)",
		transitionProperty: "background-color, box-shadow, color",
	});
}

/**
 * The label above a headline, in one of five looks. `mono` and `soft` stay neutral,
 * `quiet` is a hairline pill for hero announcements, `pill` and `numbered` carry the
 * brand. Pills round at 1rem, so a label that wraps on a phone reads as a soft card. The
 * mono label's face, weight, case and tracking read `--ui-marketing-eyebrow-*` tokens. Variants live in `data-variant`; a brand tints the mono label through
 * `--ui-marketing-eyebrow-color`, and a linked eyebrow nudges its arrow on hover.
 *
 * @returns A `css()` mixin ready for an eyebrow `span` or `a`'s `mix` prop; set
 * `data-variant` on the host.
 * @example
 * <span data-variant="mono" mix={[eyebrow()]}>{t("features.eyebrow")}</span>;
 * @example
 * <a href={post} data-variant="quiet" mix={[eyebrow()]}>{t("hero.news")}</a>;
 */
export function eyebrow<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return combine<Node>([
		inlineFlex<Node>(),
		items<Node>("center"),
		raw<Node>({ gap: "0.375rem", textDecoration: "none", maxInlineSize: "100%" }),
		text<Node>("xs"),
		when<Node>(`&:not([data-variant]), &[data-variant="${DEFAULT_EYEBROW_VARIANT}"]`, [
			raw<Node>({
				fontFamily: "var(--ui-marketing-eyebrow-font, var(--ui-font-mono, monospace))",
				fontWeight: "var(--ui-marketing-eyebrow-weight, 600)",
				textTransform: "var(--ui-marketing-eyebrow-transform, uppercase)",
				color: "var(--ui-marketing-eyebrow-color, var(--ui-neutral-fg-muted))",
				letterSpacing: "var(--ui-marketing-eyebrow-tracking, 0.1em)",
				lineHeight: "1.25rem",
			}),
		]),
		when<Node>('&:is([data-variant="quiet"], [data-variant="soft"], [data-variant="pill"])', [
			pb<Node>(1.5),
			pi<Node>(3.5),
			raw<Node>({ lineHeight: "1rem", borderRadius: "1rem", textWrap: "balance" }),
		]),
		when<Node>('&[data-variant="quiet"]', [
			weight<Node>("normal"),
			fg<Node>("neutral"),
			raw<Node>({ boxShadow: `inset 0 0 0 1px ${HAIRLINE}`, backgroundColor: "transparent" }),
		]),
		when<Node>('&[data-variant="soft"]', [
			weight<Node>("medium"),
			fg<Node>("neutral.emphasis"),
			bg<Node>("neutral.bg-tint-hover"),
		]),
		when<Node>('&[data-variant="pill"]', [
			weight<Node>("semibold"),
			fg<Node>("brand"),
			bg<Node>("brand.tint"),
			raw<Node>({ boxShadow: "inset 0 0 0 1px var(--ui-brand-border)" }),
		]),
		when<Node>('&[data-variant="numbered"]', [
			pb<Node>(1),
			pi<Node>(4),
			raw<Node>({ borderRadius: "1rem" }),
			text<Node>("sm"),
			weight<Node>("medium"),
			fg<Node>("brand"),
			raw<Node>({
				boxShadow: "inset 0 0 0 1px var(--ui-brand-border-strong)",
				fontVariantNumeric: "tabular-nums",
			}),
		]),
		when<Node>("& > [data-slot='eyebrow-index']", [
			raw<Node>({
				paddingInlineEnd: "0.5rem",
				marginInlineEnd: "0.125rem",
				borderInlineEnd: "1px solid color-mix(in oklch, currentColor 40%, transparent)",
			}),
		]),
		when<Node>("&:is(a)", [
			raw<Node>({ transition: "color 150ms, background-color 150ms, box-shadow 150ms" }),
		]),
		when<Node>("&:is(a):hover", fg<Node>("neutral.emphasis")),
		when<Node>("& > [data-slot='eyebrow-arrow']", [
			raw<Node>({ inlineSize: "0.875rem", blockSize: "0.875rem", transition: "translate 150ms" }),
		]),
		when<Node>(
			"&:is(a):hover > [data-slot='eyebrow-arrow']",
			motionSafe<Node>(raw<Node>({ translate: "2px 0" })),
		),
	]);
}

/**
 * A slow, endless turn for decoration behind hero media — concentric rings or a glow —
 * that only runs when the visitor has not asked for reduced motion.
 *
 * @param direction `"reverse"` turns counter-clockwise, so two layers can counter-rotate.
 * @returns A `css()` mixin ready for a backdrop layer's `mix` prop.
 * @example
 * <svg mix={[marketingSlowSpin()]}>…</svg>;
 */
export function marketingSlowSpin<Node extends Element = Element>(
	direction: "normal" | "reverse" = "normal",
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	return combine<Node>([
		keyframes<Node>(SLOW_SPIN_KEYFRAMES, {
			from: { rotate: "0deg" },
			to: { rotate: "360deg" },
		}),
		motionSafe<Node>(
			raw<Node>({
				animation: `${SLOW_SPIN_KEYFRAMES} ${direction === "reverse" ? "80s" : "60s"} linear infinite ${direction}`,
			}),
		),
	]);
}
