/**
 * Title + description card used in marketing feature/use-case/pricing grids. Renders
 * as a link when `href` is given (e.g. a feature card linking to its own page) or a
 * plain `<div>` otherwise (e.g. a pricing tile with no destination).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

namespace MarketingCard {
	export interface Props {
		title: string;
		description: string;
		href?: string;
	}
}

/**
 * One card inside a marketing grid: a white/near-black card with a neutral
 * border, `24px` padding, and a 12px radius.
 */
const marketingCard = css({
	display: "block",
	padding: 24,
	borderRadius: 12,
	border: "1px solid oklch(0.91 0.008 145)",
	background: "#ffffff",
	color: "inherit",
	textDecoration: "none",
	"@media (prefers-color-scheme: dark)": {
		borderColor: "oklch(0.32 0.006 145)",
		background: "oklch(0.24 0.005 145)",
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

/** Renders a marketing card, as an `<a>` when {@link MarketingCard.Props.href} is set. */
export default function MarketingCard(handle: Handle<MarketingCard.Props>) {
	return () => {
		let { title, description, href } = handle.props;
		let content = (
			<>
				<h3 mix={[marketingCardTitle]}>{title}</h3>
				<p mix={[marketingCardDescription]}>{description}</p>
			</>
		);

		if (href) {
			return (
				<a href={href} mix={[marketingCard]}>
					{content}
				</a>
			);
		}

		return <div mix={[marketingCard]}>{content}</div>;
	};
}
