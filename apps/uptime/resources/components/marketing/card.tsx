/**
 * Title + description claim cell for marketing feature/use-case grids. Renders
 * as a link when `href` is given. Thin adapter over {@link Feature} so grids
 * share the marketing feature vocabulary instead of product {@link Card} chrome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { gap, inlineFlex, items, vstack } from "@sdxc/u/layout";
import { bs } from "@sdxc/u/size";
import { fontSize, textDecoration, weight } from "@sdxc/u/typography";
import { Feature, HeadingScope } from "@sdxc/ui";

namespace MarketingCard {
	export interface Props {
		title: string;
		description: string;
		href?: string;
		/** Icon rendered in a brand-tinted well above the title. */
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
 * Renders a marketing claim cell, linked when {@link MarketingCard.Props.href}
 * is set. Titles nest under the ambient heading scope at level 3.
 */
export default function MarketingCard(handle: Handle<MarketingCard.Props>) {
	return () => {
		let { title, description, href, icon, learnMore } = handle.props;

		let cell = (
			<HeadingScope level={3}>
				<Feature mix={[href ? bs("full") : [], learnMore ? vstack({ justify: "between" }) : []]}>
					{icon ? <Feature.Icon aria-hidden="true">{icon}</Feature.Icon> : null}
					<Feature.Title>{title}</Feature.Title>
					<Feature.Description>{description}</Feature.Description>
					{learnMore ? (
						<Feature.Action>
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
						</Feature.Action>
					) : null}
				</Feature>
			</HeadingScope>
		);

		if (href) {
			return (
				<a
					href={href}
					data-rmx-prefetch="intent"
					mix={[bs("full"), textDecoration("none"), fg("inherit")]}
				>
					{cell}
				</a>
			);
		}

		return cell;
	};
}
