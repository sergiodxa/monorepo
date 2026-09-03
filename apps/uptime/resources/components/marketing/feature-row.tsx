/**
 * A compact feature entry: a small tinted icon tile beside a title and one
 * line of supporting copy. Kept separate from `MarketingCard` for its own
 * icon-beside-text layout and compact title size, suited to a long list of
 * secondary capabilities reading as a dense checklist.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, fg } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { flex, gap, items, justify, shrink } from "@sdxc/u/layout";
import { dark } from "@sdxc/u/responsive";
import { bs, is, p } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { Card, HeadingScope } from "@sdxc/ui";

namespace MarketingFeatureRow {
	export interface Props {
		title: string;
		description: string;
		/**
		 * Icon rendered in a brand-tinted 40px tile at the row's inline-start edge,
		 * sized so a wrapping title can't squeeze the glyph. Colored one step past
		 * `brand.tint`, the card's own background, so the tile stays visible.
		 */
		icon: RemixNode;
	}
}

/**
 * Icon + title + description row; padding sits directly on `Card`,
 * unpadded by default, alongside `Card.Title`/`Card.Description`. The
 * heading uses `level={3}`, nested below the page's `<h1>` and section's `<h2>`.
 */
export default function MarketingFeatureRow(handle: Handle<MarketingFeatureRow.Props>) {
	return () => {
		let { title, description, icon } = handle.props;

		return (
			<Card mix={[flex(), items("start"), gap(4), p(5)]}>
				<span
					aria-hidden="true"
					mix={[
						flex(),
						items("center"),
						justify("center"),
						is(10),
						bs(10),
						shrink(0),
						rounded("lg"),
						bg("color.brand.100"),
						dark(bg("color.brand.900")),
						fg("brand"),
					]}
				>
					{icon}
				</span>
				<div>
					<HeadingScope level={3}>
						<Card.Title mix={[fontSize("base")]}>{title}</Card.Title>
					</HeadingScope>
					<Card.Description mix={[fontSize("sm"), opacity(100), fg("neutral")]}>
						{description}
					</Card.Description>
				</div>
			</Card>
		);
	};
}
