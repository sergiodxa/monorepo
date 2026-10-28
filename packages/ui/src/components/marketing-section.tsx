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
import { is } from "@sdxc/u/size";
import { after, before } from "@sdxc/u/state";
import { textAlign } from "@sdxc/u/typography";

import type { MarketingBandTone, MarketingSectionSpacing } from "../styles/marketing.js";

import {
	marketingBandTone,
	marketingContainer,
	marketingHairline,
	marketingSectionSpace,
} from "../styles/marketing.js";

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
	 * What sits behind the band: nothing, a quiet tint, a faded grid, or an
	 * inverted solid for a closing call-to-action.
	 */
	export type Tone = MarketingBandTone;

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
		/** Per-part styling for the measured inner column. */
		parts?: PartsProps;
		/** Band content — headers, splits, feature grids, and so on. */
		children: RemixNode;
	}
}

/**
 * Renders a marketing band: tone and spacing on the `<section>`, a named
 * container for descendant queries, and a measured inner column from the
 * marketing gutters. Pair the host with `viewReveal()` from the animations
 * entry when the band should enter on scroll.
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
export function MarketingSection(handle: Handle<MarketingSection.Props>) {
	return () => {
		let { align, children, mix, parts, ruled, spacing, tone, variant, ...rest } = handle.props;
		let resolvedTone = tone ?? DEFAULT_TONE;
		let resolvedSpacing = spacing ?? DEFAULT_SPACING;
		let resolvedAlign = align ?? DEFAULT_ALIGN;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let isCenter = resolvedAlign === "center";
		let isFrame = resolvedVariant === "frame";

		return (
			<section
				{...rest}
				data-tone={resolvedTone}
				data-spacing={resolvedSpacing}
				data-align={resolvedAlign}
				data-variant={resolvedVariant}
				mix={[
					container("ui-marketing-section"),
					relative(),
					vstack({ align: "center" }),
					is("100%"),
					raw({ isolation: "isolate" }),
					marketingBandTone(resolvedTone),
					marketingSectionSpace(resolvedSpacing),
					ruled ? marketingHairline() : [],
					mix,
				]}
			>
				<div
					mix={[
						marketingContainer(),
						vstack({
							align: isCenter ? "center" : "stretch",
							gap: 0,
						}),
						relative(),
						is("100%"),
						isCenter ? textAlign("center") : [],
						isFrame
							? [
									at("md", "ui-marketing-section", [
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
							: [],
						parts?.container,
					]}
				>
					{children}
				</div>
			</section>
		);
	};
}

/**
 * The square drawn where a framed band's top rule crosses a rail, so the rails
 * read as a frame the rule is fixed to.
 */
function frameMarker(edge: { insetInlineStart: string } | { insetInlineEnd: string }) {
	return raw({
		content: '""',
		position: "absolute",
		insetBlockStart: "-4px",
		...edge,
		inlineSize: "7px",
		blockSize: "7px",
		backgroundColor: "var(--ui-brand-bg-solid)",
	});
}
