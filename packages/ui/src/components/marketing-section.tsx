/**
 * A landing-page band: a `<section>` host that applies marketing tone, spacing,
 * and content measure so pages share one rhythm. Distinct from the listbox
 * {@link Section}, which groups menu items.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { borderEdge } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { container, relative, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { is, maxIs, mi, pi } from "@sdxc/u/size";
import { after, before } from "@sdxc/u/state";
import { textAlign } from "@sdxc/u/typography";

import type { MarketingBandTone, MarketingSectionSpacing } from "../styles/marketing.js";

import {
	marketingBandTone,
	marketingContainer,
	marketingHairline,
	marketingSectionSpace,
} from "../styles/marketing.js";

import type { HeadingLevel } from "./heading-scope.js";

import { HeadingScope, readAmbientLevel } from "./heading-scope.js";

/**
 * Width of an inset panel: the page less its 0.5rem margins, capped at the content measure
 * plus 4rem a side, so the panel frames the column every other band aligns to.
 */
const INSET_INLINE_SIZE = "min(100% - 1rem, var(--ui-marketing-measure, 72rem) + 8rem)";

/** Band fill {@link MarketingSection} applies when `tone` is omitted. */
const DEFAULT_TONE: MarketingSection.Tone = "plain";

/** Block padding {@link MarketingSection} applies when `spacing` is omitted. */
const DEFAULT_SPACING: MarketingSection.Spacing = "normal";

/** Content alignment {@link MarketingSection} applies when `align` is omitted. */
const DEFAULT_ALIGN: MarketingSection.Align = "start";

/** Chrome {@link MarketingSection} applies when `variant` is omitted. */
const DEFAULT_VARIANT: MarketingSection.Variant = "default";

/**
 * Prop types for {@link MarketingSection}.
 */
export namespace MarketingSection {
	/**
	 * What sits behind the band: nothing, a quiet tint, a hairline grid, an
	 * inverted solid, the brand solid, or a page-supplied gradient.
	 */
	export type Tone = MarketingBandTone;

	/**
	 * Whether the band floats as a rounded panel inside the page: `true` rounds every
	 * corner, `"top"` / `"bottom"` round only that end so two inset bands join.
	 */
	export type Inset = boolean | "top" | "bottom";

	/**
	 * How much block padding the band leaves around its content.
	 */
	export type Spacing = MarketingSectionSpacing;

	/**
	 * Whether the inner column stretches start-aligned or centers as one
	 * statement.
	 */
	export type Align = "start" | "center";

	/**
	 * Outer chrome: a plain band, or a framed column with dashed rails and
	 * corner markers where a top rule meets them.
	 */
	export type Variant = "default" | "frame";

	/** Value {@link MarketingSection} provides to bands nested inside it. */
	export interface Context {
		/** Heading level the enclosing band's title renders at. */
		level: HeadingLevel;
	}

	/**
	 * Per-part styling for the elements the band renders besides its host.
	 */
	export interface PartsProps {
		/** Styling for the measured content column inside the band. */
		container?: TagProps<"div">["mix"];
	}

	/**
	 * Props accepted by {@link MarketingSection}.
	 */
	export interface Props extends TagProps<"section"> {
		/** Band fill. Defaults to {@link DEFAULT_TONE}. */
		tone?: Tone;
		/** Block padding step. Defaults to {@link DEFAULT_SPACING}. */
		spacing?: Spacing;
		/** Content alignment. Defaults to {@link DEFAULT_ALIGN}. */
		align?: Align;
		/**
		 * Draws a low-contrast 1px rule along the block-start edge so stacked
		 * bands separate cleanly.
		 */
		ruled?: boolean;
		/** Outer chrome. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/**
		 * Paints the band as a panel 0.5rem in from the page edges with
		 * `--ui-marketing-band-radius` (2rem) corners and an inset hairline, so a tone
		 * reads as an object on the page rather than a full-bleed stripe.
		 */
		inset?: Inset;
		/**
		 * Zeroes block padding on a framed column so a flush strip (stats) keeps
		 * full-height rails without the section gap. Ignored when `variant` is
		 * not `"frame"`.
		 */
		flush?: boolean;
		/**
		 * Heading level of the band's title, and of every heading placed directly in it.
		 * Defaults to one below the enclosing band, else one below the ambient
		 * `HeadingScope`, so bands on a bare page render `<h2>` under the hero's `<h1>`.
		 */
		level?: HeadingLevel;
		/** Per-part styling for the measured inner column. */
		parts?: PartsProps;
		/** Band content — headers, splits, feature grids, and so on. */
		children: RemixNode;
	}
}

/**
 * Renders a marketing band: tone on the `<section>`, a named container for
 * descendant queries, and a measured inner column. When `variant="frame"`,
 * block padding lives on that column with the dashed rails so the rails run
 * the full band height instead of stopping at the content box.
 *
 * @param handle Runtime handle carrying the host `<section>`'s props.
 * @returns The render function producing the band's markup.
 * @example
 * <MarketingSection tone="tinted" spacing="normal" ruled>
 * 	{children}
 * </MarketingSection>
 * @example
 * <MarketingSection tone="grid" spacing="hero" align="center" variant="frame">
 * 	{children}
 * </MarketingSection>
 */
export function MarketingSection(handle: Handle<MarketingSection.Props, MarketingSection.Context>) {
	return () => {
		let {
			align,
			children,
			flush,
			inset,
			level,
			mix,
			parts,
			ruled,
			spacing,
			tone,
			variant,
			...rest
		} = handle.props;
		let resolvedLevel = level ?? resolveBandLevel(handle);
		let resolvedTone = tone ?? DEFAULT_TONE;
		let resolvedSpacing = spacing ?? DEFAULT_SPACING;
		let resolvedAlign = align ?? DEFAULT_ALIGN;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let isCenter = resolvedAlign === "center";
		let isFrame = resolvedVariant === "frame";
		let isFlushFrame = isFrame && Boolean(flush);

		handle.context.set({ level: resolvedLevel });

		return (
			<section
				{...rest}
				data-tone={resolvedTone}
				data-spacing={resolvedSpacing}
				data-align={resolvedAlign}
				data-variant={resolvedVariant}
				data-flush={isFlushFrame ? "true" : undefined}
				data-inset={inset ? String(inset) : undefined}
				mix={[
					container("ui-marketing-section"),
					relative(),
					vstack({ align: "center" }),
					is(inset ? INSET_INLINE_SIZE : "100%"),
					raw({ isolation: "isolate", overflowX: "clip" }),
					marketingBandTone(resolvedTone),
					inset ? insetPanel(inset) : [],
					/**
					 * Framed bands keep block padding on the measured column so the
					 * dashed rails share that box and run the full band height.
					 */
					isFrame ? [] : marketingSectionSpace(resolvedSpacing),
					ruled ? marketingHairline() : [],
					mix,
				]}
			>
				<HeadingScope level={resolvedLevel}>
					<div
						mix={[
							isFrame
								? [
										maxIs("var(--ui-marketing-measure, 72rem)"),
										mi("auto"),
										is("100%"),
										/**
										 * Match the pre-migration framed band: quiet gutters that
										 * open to 3rem above `lg`, so copy clears the rails.
										 */
										pi(5),
										isFlushFrame ? [] : marketingSectionSpace(resolvedSpacing),
										at("lg", "ui-marketing-section", [
											pi(12),
											borderEdge("inline-start", {
												color: "neutral",
												width: 1,
												style: "dashed",
											}),
											borderEdge("inline-end", {
												color: "neutral",
												width: 1,
												style: "dashed",
											}),
											ruled
												? [
														before(frameMarker({ insetInlineStart: "-4px" })),
														after(frameMarker({ insetInlineEnd: "-4px" })),
													]
												: [],
										]),
									]
								: measuredColumn(Boolean(inset)),
							vstack({
								align: isCenter ? "center" : "stretch",
								gap: 0,
							}),
							relative(),
							is("100%"),
							isCenter ? textAlign("center") : [],
							parts?.container,
						]}
					>
						{children}
					</div>
				</HeadingScope>
			</section>
		);
	};
}

/**
 * One level below the enclosing band, else one below the ambient scope, else `2`: the
 * page's `<h1>` belongs to its hero, so a band composed on a bare page is a chapter of it.
 */
function resolveBandLevel(handle: Handle<MarketingSection.Props, MarketingSection.Context>) {
	let enclosing = readEnclosingBand(handle);
	let parent = enclosing ?? readAmbientLevel(handle) ?? 1;

	return Math.min(parent + 1, 6) as HeadingLevel;
}

/** Level of the nearest enclosing band's title, or `undefined` outside any band. */
function readEnclosingBand(handle: Handle<MarketingSection.Props, MarketingSection.Context>) {
	try {
		return (handle.context.get(MarketingSection) as MarketingSection.Context | undefined)?.level;
	} catch {
		return undefined;
	}
}

/** The measured column of a band that is not framed: inset panels pull in their gutter. */
function measuredColumn(inset: boolean) {
	return inset ? insetContainer() : marketingContainer();
}

/**
 * The measured column inside an inset panel: each gutter step, its breakpoint and the
 * measure less the panel's 0.5rem margin a side, so the band's text shares the edges of
 * the bands around it at every width.
 */
function insetContainer() {
	return raw({
		maxInlineSize: "calc(var(--ui-marketing-measure, 72rem) - 1rem)",
		marginInline: "auto",
		paddingInline: "calc(var(--ui-marketing-gutter, 1rem) - 0.5rem)",
		"@container (min-width: 35rem)": { paddingInline: "1rem" },
		"@container (min-width: 47rem)": { paddingInline: "1.5rem" },
	});
}

/**
 * The "+" drawn where a framed band's top rule crosses a rail, so the rails read as a
 * frame the rule is fixed to; two 1px gradients in the hairline ink keep it quiet.
 */
function frameMarker(edge: { insetInlineStart: string } | { insetInlineEnd: string }) {
	return raw({
		content: '""',
		position: "absolute",
		insetBlockStart: "-4px",
		...edge,
		inlineSize: "9px",
		blockSize: "9px",
		backgroundImage:
			"linear-gradient(var(--ui-neutral-fg-muted), var(--ui-neutral-fg-muted)), linear-gradient(var(--ui-neutral-fg-muted), var(--ui-neutral-fg-muted))",
		backgroundSize: "1px 100%, 100% 1px",
		backgroundPosition: "center",
		backgroundRepeat: "no-repeat",
	});
}

/**
 * The rounded panel an inset band paints: centred inside the page's 0.5rem margins, the
 * band radius on the ends it rounds, and an inset hairline that keeps a light tone's
 * edge visible against the page.
 */
function insetPanel(inset: MarketingSection.Inset) {
	let radius = "var(--ui-marketing-band-radius, 2rem)";
	let top = inset === "bottom" ? "0" : radius;
	let bottom = inset === "top" ? "0" : radius;

	return raw({
		marginInline: "auto",
		marginBlockStart: inset === "bottom" ? "0" : "0.5rem",
		borderStartStartRadius: top,
		borderStartEndRadius: top,
		borderEndStartRadius: bottom,
		borderEndEndRadius: bottom,
		boxShadow: "inset 0 0 0 1px var(--ui-marketing-hairline)",
	});
}
