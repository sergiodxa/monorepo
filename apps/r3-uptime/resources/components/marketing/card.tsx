/**
 * Title + description card used in marketing feature/use-case/pricing grids. Renders
 * as a link when `href` is given (e.g. a feature card linking to its own page) or a
 * plain `<div>` otherwise (e.g. a pricing tile with no destination).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";

namespace MarketingCard {
	export interface Props {
		title: string;
		description: string;
		href?: string;
	}
}

/** Renders a {@link s.marketingCard}, as an `<a>` when {@link MarketingCard.Props.href} is set. */
export default function MarketingCard(handle: Handle<MarketingCard.Props>) {
	return () => {
		let { title, description, href } = handle.props;
		let content = (
			<>
				<h3 mix={[s.marketingCardTitle]}>{title}</h3>
				<p mix={[s.marketingCardDescription]}>{description}</p>
			</>
		);

		if (href) {
			return (
				<a href={href} mix={[s.marketingCard]}>
					{content}
				</a>
			);
		}

		return <div mix={[s.marketingCard]}>{content}</div>;
	};
}
