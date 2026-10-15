/**
 * A `gridTemplate` example with `repeat("auto-fit", ...)`, letting the grid fit as many
 * columns of a minimum width as its own width allows, with no media query.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate, repeat } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A grid that fits as many columns as its width allows. */
export default {
	title: "Fitting as many columns as possible",
	description:
		'Use `repeat("auto-fit", "minmax(8rem, 1fr)")` to fit as many columns as the grid\'s width allows, each at least 8rem wide:',
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: repeat("auto-fit", "minmax(8rem, 1fr)") }), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
			<div mix={[demo.block()]}>06</div>
			<div mix={[demo.block()]}>07</div>
		</div>
	),
} satisfies UtilityExampleModule;
