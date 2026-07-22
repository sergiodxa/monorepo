/**
 * One numbered item in a "how it works" list. The number itself is drawn by a CSS
 * counter, not client script. Reuses `@pkg/r3-ui`'s `Card.Title`/`Card.Description`
 * for its title/description typography — the same pieces `card.tsx` composes —
 * instead of re-declaring the same two `css()` blocks a second time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Card, HeadingScope } from "@pkg/r3-ui";
import { css } from "remix/ui";

namespace MarketingStep {
	export interface Props {
		title: string;
		description: string;
	}
}

/**
 * One step inside a numbered steps grid, numbered via a `::before` circle in
 * the brand-primary color with on-solid text.
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
		background: "var(--ui-primary-bg-solid)",
		color: "var(--ui-primary-fg-on-solid)",
		fontSize: "0.8125rem",
		fontWeight: 700,
	},
});

/** Renders one numbered step entry with a title and description. */
export default function MarketingStep(handle: Handle<MarketingStep.Props>) {
	return () => (
		<div mix={[marketingStep]}>
			{/* `level={3}`: nested below each page's own `<h1>` hero and `<h2>` "How it works" heading. */}
			<HeadingScope level={3}>
				<Card.Title mix={[css({ fontSize: "1.25rem" })]}>{handle.props.title}</Card.Title>
			</HeadingScope>
			<Card.Description
				mix={[css({ fontSize: "1rem", opacity: 1, color: "var(--ui-neutral-fg)" })]}
			>
				{handle.props.description}
			</Card.Description>
		</div>
	);
}
