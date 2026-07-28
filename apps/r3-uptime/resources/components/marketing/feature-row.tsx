/**
 * A compact feature entry: a small tinted icon tile beside a title and one line of
 * supporting copy. Sits next to `MarketingCard` rather than inside it as a variant —
 * this one lays its icon *beside* the text instead of above it, and drops the card's
 * larger title size, so a long list of secondary capabilities reads as a dense
 * checklist rather than a grid of equally-weighted cards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Card, HeadingScope } from "@pkg/r3-ui";
import { bg, fg } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { flex, gap, items, justify, shrink } from "@pkg/u/layout";
import { dark } from "@pkg/u/responsive";
import { bs, is, p } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";

namespace MarketingFeatureRow {
	export interface Props {
		title: string;
		description: string;
		/** Icon rendered in a brand-tinted 40px tile at the row's inline-start edge. */
		icon: RemixNode;
	}
}

/** Renders one icon + title + description row inside a features grid. */
export default function MarketingFeatureRow(handle: Handle<MarketingFeatureRow.Props>) {
	return () => {
		let { title, description, icon } = handle.props;

		// `Card` carries no padding of its own — that lives on `Card.Header`, which
		// this row's icon-beside-text layout doesn't use — so it's set here.
		return (
			<Card mix={[flex(), items("start"), gap(4), p(5)]}>
				{/* The icon's own tile: a 40px brand-tinted rounded square that never
				shrinks, so a wrapping title can't squeeze the glyph. One palette step
				past `brand.tint` in each scheme — that token is the card's own
				background here, so the tile would be invisible. */}
				<span
					aria-hidden
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
					{/* `level={3}`: nested below the page's own `<h1>` hero and this
					section's `<h2>` heading. */}
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
