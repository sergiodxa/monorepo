/**
 * A `leading` example with values off the named scale: a bare number as a ratio of the
 * font size, and a length fixing the line box whatever the size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate } from "@sdxc/u/layout";
import { leading } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A unitless ratio and a fixed length as line heights. */
export default {
	title: "Numbers and lengths",
	description:
		'Pass a number for a line height relative to the font size, like `leading(1.8)`, or a length to fix it, like `leading("2rem")`:',
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: "1fr 1fr" }), gap(8)]}>
			<div>
				<p mix={[demo.caption()]}>leading(1.8)</p>
				<p mix={[leading(1.8)]}>
					The night train to Lisbon leaves at ten. Bring a book, a sweater, and something to eat,
					because the dining car closes long before the border.
				</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>leading("2rem")</p>
				<p mix={[leading("2rem")]}>
					The night train to Lisbon leaves at ten. Bring a book, a sweater, and something to eat,
					because the dining car closes long before the border.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
