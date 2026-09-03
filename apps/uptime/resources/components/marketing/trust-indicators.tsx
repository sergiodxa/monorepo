/**
 * The four-up band of headline figures below a marketing hero: one brand-tinted icon,
 * mono figure, and label per column, inside a bordered tinted strip. Every marketing
 * page carries its own page-specific set of figures, so the band is centralized here
 * for every page family to reuse.
 *
 * Icons arrive as already-rendered nodes: a caller reading its figures out of content
 * data resolves them through `<Icon name>`, while one importing a specific `<XyzIcon>`
 * passes that straight through, and this component renders either one the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, borderEdge, fg } from "@sdxc/u/color";
import { gap, grid, gridTemplate, inlineFlex, items, vstack } from "@sdxc/u/layout";
import { dark, media } from "@sdxc/u/responsive";
import { m, maxIs, mi, pb, pi } from "@sdxc/u/size";
import { font, fontSize, leading, textAlign, weight } from "@sdxc/u/typography";

namespace MarketingTrustIndicators {
	/** One headline figure: its icon, the figure itself, and what the figure measures. */
	export interface Indicator {
		/** Already-rendered icon node, drawn in the brand color beside the figure. */
		icon: RemixNode;
		/** The figure, rendered in the mono face so digits align across columns (`"9"`, `"1-60m"`, `"365d"`). */
		value: string;
		/**
		 * What {@link Indicator.value} is announced as when the figure is a symbol —
		 * `"∞"` would otherwise go unannounced or get spelled out. Rendered via
		 * `role="img"` on the value span, so only this text reaches a screen reader.
		 */
		valueLabel?: string;
		label: string;
	}

	export interface Props {
		indicators: Indicator[];
	}
}

/**
 * Renders the trust-indicator strip: two columns of figures below 768px, four
 * at or above it, painted one palette step off the page's own body color in
 * each scheme so it reads as a distinct band framed by the hero and content.
 */
export default function MarketingTrustIndicators(handle: Handle<MarketingTrustIndicators.Props>) {
	return () => (
		<section
			mix={[
				pb(8),
				bg("color.neutral.100"),
				dark(bg("color.neutral.900")),
				borderEdge("top", { color: "neutral", width: 1 }),
				borderEdge("bottom", { color: "neutral", width: 1 }),
			]}
		>
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
