/**
 * Title + description card used in marketing feature/use-case/pricing grids. Renders
 * as a link when `href` is given (e.g. a feature card linking to its own page) or a
 * plain panel otherwise (e.g. a pricing tile with no destination). Composes
 * `@pkg/r3-ui`'s `Card`/`Card.Header`/`Card.Title`/`Card.Description` for its panel
 * chrome instead of a hand-rolled `css()` block; `Card` itself always renders a
 * `<section>` (no polymorphic `href`/`as` prop), so the link variant wraps that
 * panel in a plain block-level `<a>` instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Card, HeadingScope } from "@pkg/r3-ui";
import { css } from "remix/ui";

namespace MarketingCard {
	export interface Props {
		title: string;
		description: string;
		href?: string;
	}
}

/** Renders a marketing card, wrapped in a link when {@link MarketingCard.Props.href} is set. */
export default function MarketingCard(handle: Handle<MarketingCard.Props>) {
	return () => {
		let { title, description, href } = handle.props;

		let card = (
			// `level={3}`: every marketing page nests this grid below its own
			// `<h1>` hero and `<h2>` section heading, so each card's own title
			// renders as `<h3>` regardless of whatever (if any) ambient
			// `HeadingScope` wraps the page.
			<HeadingScope level={3}>
				<Card mix={[href && css({ height: "100%" })]}>
					<Card.Header>
						<Card.Title mix={[css({ fontSize: "1.25rem" })]}>{title}</Card.Title>
						<Card.Description
							mix={[css({ fontSize: "1rem", opacity: 1, color: "var(--ui-neutral-fg)" })]}
						>
							{description}
						</Card.Description>
					</Card.Header>
				</Card>
			</HeadingScope>
		);

		if (href) {
			return (
				<a
					href={href}
					mix={[
						css({ display: "block", height: "100%", textDecoration: "none", color: "inherit" }),
					]}
				>
					{card}
				</a>
			);
		}

		return card;
	};
}
