/**
 * The four-up band of headline figures below a marketing hero: one brand-tinted icon,
 * mono figure, and label per column, inside a bordered tinted strip. Every marketing
 * page carries its own page-specific set of figures ("9 / Global Regions", "1-60m /
 * Check Intervals"), so the band itself is centralized here instead of being composed
 * by hand once per page family.
 *
 * Icons arrive as already-rendered nodes rather than Lucide names: a caller reading
 * its figures out of content data resolves them through `<Icon name>`, while one
 * importing a specific `<XyzIcon>` passes that straight through, and this component
 * doesn't have to know which.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, borderEdge, fg } from "@pkg/u/color";
import { gap, grid, gridTemplate, inlineFlex, items, vstack } from "@pkg/u/layout";
import { dark, media } from "@pkg/u/responsive";
import { m, maxIs, mi, pb, pi } from "@pkg/u/size";
import { font, fontSize, leading, textAlign, weight } from "@pkg/u/typography";

namespace MarketingTrustIndicators {
	/** One headline figure: its icon, the figure itself, and what the figure measures. */
	export interface Indicator {
		/** Already-rendered icon node, drawn in the brand color beside the figure. */
		icon: RemixNode;
		/** The figure, rendered in the mono face so digits align across columns (`"9"`, `"1-60m"`, `"365d"`). */
		value: string;
		/**
		 * What {@link Indicator.value} says out loud, for a figure that is a symbol rather than
		 * something readable — `"∞"` is announced as "infinity", or at low symbol verbosity as
		 * nothing at all, which would leave the column as a label with no figure under it.
		 *
		 * Supplying it swaps the glyph for this text entirely rather than adding to it, so the
		 * figure is heard once and as a word.
		 */
		valueLabel?: string;
		label: string;
	}

	export interface Props {
		indicators: Indicator[];
	}
}

/** Renders the trust-indicator strip: two columns of figures below 768px, four at or above it. */
export default function MarketingTrustIndicators(handle: Handle<MarketingTrustIndicators.Props>) {
	return () => (
		<section
			// A distinctly tinted band between the hero and the first content section:
			// one palette step off the page's own body color in each scheme, rather than
			// the semantic `bg("neutral.tint")` — that resolves to the *same* token the
			// body already paints, so the strip would read as unseparated from the hero.
			mix={[
				pb(8),
				bg("color.neutral.100"),
				dark(bg("color.neutral.900")),
				borderEdge("top", { color: "neutral", width: 1 }),
				borderEdge("bottom", { color: "neutral", width: 1 }),
			]}
		>
			{/* Same centered wrapper every marketing section uses: capped at 1152px with
			16/24/32px side padding by breakpoint, so the figures line up with the hero
			text above them. Inlined rather than shared, since this component ships its
			own `<section>` and has exactly one wrapper to style. */}
			<div
				mix={[
					maxIs("1152px"),
					mi("auto"),
					pi(4),
					media("(min-width: 640px)", pi(6)),
					media("(min-width: 1024px)", pi(8)),
				]}
			>
				<div
					mix={[
						grid(),
						gap(8),
						gridTemplate({ columns: "repeat(2, 1fr)" }),
						textAlign("center"),
						media("(min-width: 768px)", gridTemplate({ columns: "repeat(4, 1fr)" })),
					]}
				>
					{handle.props.indicators.map((indicator) => (
						<div key={indicator.label} mix={[vstack({ gap: 2, align: "center" })]}>
							<div
								mix={[
									inlineFlex(),
									items("center"),
									gap(1),
									fontSize("3xl"),
									weight(700),
									leading(1),
									fg("neutral.emphasis"),
								]}
							>
								<span mix={[fg("brand")]}>{indicator.icon}</span>
								{/*
								 * `role="img"` with the name on it, rather than the glyph plus visually
								 * hidden text: it makes the span an opaque labelled node, so the symbol
								 * inside is never announced alongside the word or spelled out.
								 */}
								{indicator.valueLabel ? (
									<span mix={[font("mono")]} role="img" aria-label={indicator.valueLabel}>
										{indicator.value}
									</span>
								) : (
									<span mix={[font("mono")]}>{indicator.value}</span>
								)}
							</div>
							<p mix={[m(0), fontSize("sm"), fg("neutral")]}>{indicator.label}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
