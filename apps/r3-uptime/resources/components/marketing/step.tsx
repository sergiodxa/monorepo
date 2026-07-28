/**
 * One numbered item in a "how it works" list: a large centered counter medallion above
 * a centered title and description, with a connector line reaching toward the next
 * step. Both the number and the connector are pure CSS — a `counter()` in `::before`
 * and a positioned `::after` rule — so a three-step row needs no client script and no
 * index prop threaded in from the caller. Reuses `@pkg/r3-ui`'s
 * `Card.Title`/`Card.Description` for its title/description typography — the same
 * pieces `card.tsx` composes — instead of re-declaring the same two `css()` blocks a
 * second time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Card, HeadingScope } from "@pkg/r3-ui";
import { bg, fg } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { counterIncrement, pseudoContent } from "@pkg/u/general";
import {
	absolute,
	block,
	flex,
	hidden,
	insBs,
	insIs,
	items,
	justify,
	relative,
	vstack,
} from "@pkg/u/layout";
import { dark, media } from "@pkg/u/responsive";
import { bs, is, mbe } from "@pkg/u/size";
import { after, before, not } from "@pkg/u/state";
import { fontSize, textAlign, weight } from "@pkg/u/typography";

namespace MarketingStep {
	export interface Props {
		title: string;
		description: string;
	}
}

/** Renders one numbered step entry with a title and description. */
export default function MarketingStep(handle: Handle<MarketingStep.Props>) {
	return () => (
		<div
			mix={[
				relative(),
				vstack({ align: "center" }),
				textAlign("center"),
				counterIncrement("marketing-step"),
				// The step's number: a 64px brand-solid medallion in normal flow above the
				// title, so the column centers itself without any absolute positioning.
				before([
					pseudoContent("counter(marketing-step)"),
					flex(),
					items("center"),
					justify("center"),
					is(16),
					bs(16),
					mbe(6),
					rounded("50%"),
					bg("brand.solid"),
					fg("brand.onSolid"),
					fontSize("2xl"),
					weight(700),
				]),
				// The connector reaching from this medallion toward the next step's, drawn
				// from the medallion's vertical center across the grid gap. Only at ≥1024px,
				// where the steps grid is three columns wide and every non-last step really
				// does have a sibling to its right — at the 768px two-column stage the line
				// would point off the end of the row instead. Nested inside this one mixin
				// rather than added as a second entry in the array so the `@media` block
				// merges into the same rule as the `display: none` it overrides, which makes
				// it immune to `@layer` ordering between separate mixins.
				not(
					":last-child",
					after([
						pseudoContent('""'),
						hidden(),
						absolute(),
						insBs("32px"),
						insIs("calc(50% + 2rem)"),
						is("calc(100% - 4rem)"),
						bs("2px"),
						bg("color.brand.200"),
						dark(bg("color.brand.800")),
						media("(min-width: 1024px)", block()),
					]),
				),
			]}
		>
			{/* `level={3}`: nested below each page's own `<h1>` hero and `<h2>` "How it works" heading. */}
			<HeadingScope level={3}>
				<Card.Title mix={[fontSize("xl")]}>{handle.props.title}</Card.Title>
			</HeadingScope>
			<Card.Description mix={[fontSize("base"), opacity(100), fg("neutral")]}>
				{handle.props.description}
			</Card.Description>
		</div>
	);
}
