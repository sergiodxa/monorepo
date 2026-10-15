/**
 * A `gridTemplate` example setting rows and columns together, so a header and a footer
 * take their content's height and the body takes the rest of a fixed-height grid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate } from "@sdxc/u/layout";
import { bs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A grid with explicit rows and columns. */
export default {
	title: "Defining rows",
	description:
		'Pass `rows` beside `columns` to size the rows too, like `"auto 1fr auto"` for a header, a body that fills the rest and a footer:',
	align: "stretch",
	render: () => (
		<div
			mix={[grid(), gridTemplate({ columns: "8rem 1fr", rows: "auto 1fr auto" }), gap(4), bs(64)]}
		>
			<div mix={[demo.block()]}>auto</div>
			<div mix={[demo.block()]}>auto</div>
			<div mix={[demo.block()]}>1fr</div>
			<div mix={[demo.block()]}>1fr</div>
			<div mix={[demo.block()]}>auto</div>
			<div mix={[demo.block()]}>auto</div>
		</div>
	),
} satisfies UtilityExampleModule;
