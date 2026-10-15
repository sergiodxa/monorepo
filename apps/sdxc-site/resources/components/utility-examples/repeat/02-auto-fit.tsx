/**
 * A `repeat` example with `"auto-fit"` and `minmax()`: a responsive grid that fits as
 * many columns as the width allows, with no breakpoint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate, repeat } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Auto-fit lets the grid pick its column count from the room it has. */
export default {
	title: "Fitting as many columns as fit",
	description:
		'Pass `"auto-fit"` as the count and a `minmax()` track to fit as many columns as the width allows. Resize the window to see the columns reflow:',
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: repeat("auto-fit", "minmax(7rem, 1fr)") }), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
			<div mix={[demo.block()]}>06</div>
		</div>
	),
} satisfies UtilityExampleModule;
