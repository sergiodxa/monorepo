/**
 * Title + description card for marketing feature/use-case/pricing grids.
 * Renders as a link when `href` is given, or a plain panel otherwise.
 * Composes `Card`'s `<section>` chrome directly since `Card` has no
 * polymorphic `href`/`as` prop, so the link variant wraps that panel in
 * its own `<a>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { ArrowRightIcon } from "@pkg/icons";
import { bg, fg } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { block, flex, gap, inlineFlex, items, justify, vstack } from "@pkg/u/layout";
import { dark } from "@pkg/u/responsive";
import { bs, is } from "@pkg/u/size";
import { fontSize, textDecoration, weight } from "@pkg/u/typography";
import { Card, HeadingScope } from "@pkg/ui";

namespace MarketingCard {
	export interface Props {
		title: string;
		description: string;
		href?: string;
		/** Icon rendered in a brand-tinted 48px tile above the title. */
		icon?: RemixNode;
		/**
		 * Already-translated "Learn more" label (`landing.features.learnMore`),
		 * rendered with a trailing arrow below the description — meaningful only
		 * alongside {@link MarketingCard.Props.href}, as the card's own link affordance.
		 */
		learnMore?: string;
	}
}

/**
 * Renders a marketing card, linked when {@link MarketingCard.Props.href} is set.
 * Titles render at heading level 3, below a page's hero and section headings.
 * The icon tile sits one step past `brand.tint` to stay visible on the card's fill.
 */
export default function MarketingCard(handle: Handle<MarketingCard.Props>) {
	return () => {
		let { title, description, href, icon, learnMore } = handle.props;

		let card = (
			<HeadingScope level={3}>
				<Card mix={[href && bs("full"), learnMore && vstack({ justify: "between" })]}>
					<Card.Header>
						{icon && (
							<span
								aria-hidden="true"
								mix={[
									flex(),
									items("center"),
									justify("center"),
									is(12),
									bs(12),
									rounded("xl"),
									bg("color.brand.100"),
									dark(bg("color.brand.900")),
									fg("brand"),
								]}
							>
								{icon}
							</span>
						)}
						<Card.Title mix={[fontSize("xl")]}>{title}</Card.Title>
						<Card.Description mix={[fontSize("base"), opacity(100), fg("neutral")]}>
							{description}
						</Card.Description>
					</Card.Header>
					{learnMore && (
						<Card.Footer>
							<span
								mix={[
									inlineFlex(),
									items("center"),
									gap(1),
									fontSize("sm"),
									weight(500),
									fg("brand"),
								]}
							>
								{learnMore}
								<ArrowRightIcon size={16} strokeWidth={1.5} />
							</span>
						</Card.Footer>
					)}
				</Card>
			</HeadingScope>
		);

		if (href) {
			return (
				<a href={href} mix={[block(), bs("full"), textDecoration("none"), fg("inherit")]}>
					{card}
				</a>
			);
		}

		return card;
	};
}
