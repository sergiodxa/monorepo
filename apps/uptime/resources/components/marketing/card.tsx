/**
 * Title + description card used in marketing feature/use-case/pricing grids. Renders
 * as a link when `href` is given (e.g. a feature card linking to its own page) or a
 * plain panel otherwise (e.g. a pricing tile with no destination). Composes
 * `@pkg/r3-ui`'s `Card`/`Card.Header`/`Card.Title`/`Card.Description` for its panel
 * chrome instead of a hand-rolled `css()` block; `Card` itself always renders a
 * `<section>` (no polymorphic `href`/`as` prop), so the link variant wraps that
 * panel in a plain block-level `<a>` instead.
 *
 * An `icon` renders in a tinted rounded tile above the title, and `learnMore` adds a
 * brand-colored label with a trailing arrow at the card's block-end edge. Both are
 * optional so the plain title+description grids (marketing page templates, pricing
 * tiles) keep rendering exactly as before.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { ArrowRightIcon } from "@pkg/lucide-remix";
import { Card, HeadingScope } from "@pkg/r3-ui";
import { bg, fg } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { block, flex, gap, inlineFlex, items, justify, vstack } from "@pkg/u/layout";
import { dark } from "@pkg/u/responsive";
import { bs, is } from "@pkg/u/size";
import { fontSize, textDecoration, weight } from "@pkg/u/typography";

namespace MarketingCard {
	export interface Props {
		title: string;
		description: string;
		href?: string;
		/** Icon rendered in a brand-tinted 48px tile above the title. */
		icon?: RemixNode;
		/**
		 * Already-translated "Learn more" label (`landing.features.learnMore`),
		 * rendered with a trailing arrow below the description. Only meaningful
		 * alongside {@link MarketingCard.Props.href} — the whole card is the link,
		 * so this reads as its affordance rather than a second link of its own.
		 */
		learnMore?: string;
	}
}

/** Renders a marketing card, wrapped in a link when {@link MarketingCard.Props.href} is set. */
export default function MarketingCard(handle: Handle<MarketingCard.Props>) {
	return () => {
		let { title, description, href, icon, learnMore } = handle.props;

		let card = (
			// `level={3}`: every marketing page nests this grid below its own
			// `<h1>` hero and `<h2>` section heading, so each card's own title
			// renders as `<h3>` regardless of whatever (if any) ambient
			// `HeadingScope` wraps the page.
			<HeadingScope level={3}>
				{/* `vstack` only when there's a footer to push to the block-end edge, so
				every plain title+description card keeps its default block layout. */}
				<Card mix={[href && bs("full"), learnMore && vstack({ justify: "between" })]}>
					<Card.Header>
						{icon && (
							// The icon's own tile: a 48px brand-tinted rounded square, so the
							// glyph reads as a card affordance rather than inline text. One
							// palette step past `brand.tint` in each scheme — that token is the
							// card's own background here, so the tile would be invisible.
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
