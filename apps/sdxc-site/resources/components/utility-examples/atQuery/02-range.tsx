/**
 * An `atQuery` example that combines two conditions with `and` against a named
 * container, so the card is tinted only inside a range of widths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { container, gap, grid, resize } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { atQuery } from "@sdxc/u/responsive";
import { bs, fit, is, minIs } from "@sdxc/u/size";
import { weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A named container query bounded on both sides. */
export default {
	title: "Combining conditions",
	description:
		'Combine conditions and name the container in the query, like `atQuery("panel (min-width: 20rem) and (max-width: 36rem)", ...)`, to style a range of widths. The card is tinted only inside it. Drag the handle at the box\'s bottom-right corner to resize it and watch the layout change:',
	align: "stretch",
	render: () => (
		<div mix={[container("panel"), resize("horizontal"), overflow(), minIs(48), demo.panel()]}>
			<article
				mix={[
					grid(),
					gap(4),
					atQuery("panel (min-width: 20rem) and (max-width: 36rem)", bg("brand.tint")),
				]}
			>
				<img src={demo.photoUrl()} alt="" mix={[is("100%"), bs(24), fit(), rounded("md")]} />
				<div>
					<h3 mix={[weight("semibold")]}>Lakeside cabin</h3>
					<p mix={[demo.caption()]}>Sleeps four, with a dock on the water.</p>
				</div>
			</article>
		</div>
	),
} satisfies UtilityExampleModule;
