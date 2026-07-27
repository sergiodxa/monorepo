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
import { bg, fg } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { counterIncrement, pseudoContent } from "@pkg/u/general";
import { absolute, flex, insBs, insIs, items, justify, relative } from "@pkg/u/layout";
import { bs, is, pis } from "@pkg/u/size";
import { before } from "@pkg/u/state";
import { fontSize, weight } from "@pkg/u/typography";

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
			// One step inside a numbered steps grid, numbered via a `::before` circle in
			// the brand-primary color with on-solid text.
			mix={[
				relative(),
				pis(10),
				counterIncrement("marketing-step"),
				before([
					pseudoContent("counter(marketing-step)"),
					absolute(),
					insIs(0),
					insBs(0),
					flex(),
					items("center"),
					justify("center"),
					is(7),
					bs(7),
					rounded("50%"),
					bg("primary.solid"),
					fg("primary.onSolid"),
					fontSize("0.8125rem"),
					weight(700),
				]),
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
