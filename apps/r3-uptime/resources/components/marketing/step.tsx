/**
 * One numbered item in a "how it works" list. The number itself is drawn by a CSS
 * counter, not client script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

namespace MarketingStep {
	export interface Props {
		title: string;
		description: string;
	}
}

/**
 * One step inside a numbered steps grid, numbered via `::before`, matching the OLD
 * APP's step circles (`bg-primary-600 text-white`).
 */
const marketingStep = css({
	position: "relative",
	paddingLeft: 40,
	counterIncrement: "marketing-step",
	"&::before": {
		content: "counter(marketing-step)",
		position: "absolute",
		left: 0,
		top: 0,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		width: 28,
		height: 28,
		borderRadius: "50%",
		background: "oklch(0.6 0.16 142)",
		color: "#ffffff",
		fontSize: "0.8125rem",
		fontWeight: 700,
	},
});

/** Card/section heading inside a marketing card, measured 20px/600/28px line-height. */
const marketingCardTitle = css({
	fontSize: "1.25rem",
	fontWeight: 600,
	lineHeight: "1.75rem",
	margin: "0 0 6px",
	color: "oklch(0.24 0.005 145)",
	"@media (prefers-color-scheme: dark)": { color: "oklch(0.98 0.005 145)" },
});

/** Card description text, muted, measured at the base 16px body size. */
const marketingCardDescription = css({
	fontSize: "1rem",
	color: "oklch(0.52 0.01 145)",
	margin: 0,
	lineHeight: 1.55,
	"@media (prefers-color-scheme: dark)": { color: "oklch(0.73 0.01 145)" },
});

/** Renders one numbered step entry with a title and description. */
export default function MarketingStep(handle: Handle<MarketingStep.Props>) {
	return () => (
		<div mix={[marketingStep]}>
			<h3 mix={[marketingCardTitle]}>{handle.props.title}</h3>
			<p mix={[marketingCardDescription]}>{handle.props.description}</p>
		</div>
	);
}
