/**
 * One numbered item in a "how it works" list: a centered counter medallion
 * above a title and description, with a connector line toward the next
 * step. Both are pure CSS — a `counter()` in `::before`, a positioned
 * `::after` — so a row of steps needs no client script or index prop.
 * Reuses `@sdxc/ui`'s `Card.Title`/`Card.Description` for typography.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { bg, fg } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { counterIncrement, pseudoContent } from "@sdxc/u/general";
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
} from "@sdxc/u/layout";
import { dark, media } from "@sdxc/u/responsive";
import { bs, is, mbe } from "@sdxc/u/size";
import { after, before, not } from "@sdxc/u/state";
import { fontSize, textAlign, weight } from "@sdxc/u/typography";
import { Card, HeadingScope } from "@sdxc/ui";

namespace MarketingStep {
	export interface Props {
		title: string;
		description: string;
	}
}

/**
 * Renders a numbered step. The medallion sits in normal flow, centering
 * the column; its connector shows only at ≥1024px's three-column grid;
 * the heading uses `level={3}` below the page's `<h1>` and the list's `<h2>`.
 */
export default function MarketingStep(handle: Handle<MarketingStep.Props>) {
	return () => (
		<div
			mix={[
				relative(),
				vstack({ align: "center" }),
				textAlign("center"),
				counterIncrement("marketing-step"),
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
			<HeadingScope level={3}>
				<Card.Title mix={[fontSize("xl")]}>{handle.props.title}</Card.Title>
			</HeadingScope>
			<Card.Description mix={[fontSize("base"), opacity(100), fg("neutral")]}>
				{handle.props.description}
			</Card.Description>
		</div>
	);
}
