/**
 * The opening `gridAutoRows` example: every row of a grid made the same height from one
 * step of the spacing scale, however short its content is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridAutoRows, gridTemplate, repeat } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Implicit grid rows sized from the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `gridAutoRows(n)` to size the rows a grid creates for its items, like `gridAutoRows(16)` for 4rem rows:",
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: repeat(3, 1) }), gridAutoRows(16), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
			<div mix={[demo.block()]}>06</div>
		</div>
	),
} satisfies UtilityExampleModule;
