/**
 * Numeric proof strip below a marketing hero: icon + mono figure + label per
 * cell. Thin adapter over {@link ProofStrip} and {@link StatStrip} so the
 * product's four-up metrics share the marketing proof rhythm.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { gap, inlineFlex, items } from "@sdxc/u/layout";
import { font, fontSize, leading, weight } from "@sdxc/u/typography";
import { StatStrip } from "@sdxc/ui";
import { ProofStrip } from "@sdxc/ui/patterns";

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
		/**
		 * Forwarded to {@link ProofStrip} so landing bands can share scroll
		 * reveals and other host mixins without a second wrapper.
		 */
		mix?: TagProps<"section">["mix"];
	}
}

/**
 * Renders the trust-indicator strip as a compact ruled proof band: two columns
 * below the stack breakpoint, opening wider on large containers.
 */
export default function MarketingTrustIndicators(handle: Handle<MarketingTrustIndicators.Props>) {
	return () => {
		let { indicators, mix } = handle.props;

		return (
			<ProofStrip tone="tinted" mix={mix}>
				<StatStrip variant="gap">
					{indicators.map((indicator) => (
						<StatStrip.Item key={indicator.label} label={indicator.label} mix={[items("center")]}>
							<span
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
							</span>
						</StatStrip.Item>
					))}
				</StatStrip>
			</ProofStrip>
		);
	};
}
