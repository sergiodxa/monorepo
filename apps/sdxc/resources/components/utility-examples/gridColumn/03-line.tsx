/**
 * A `gridColumn` example with bare numbers, each naming the line an item starts on, so
 * items skip the columns before it and leave them empty.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridColumn, gridTemplate, repeat } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Grid items started on a given column line, leaving earlier columns empty. */
export default {
	title: "Starting on a line",
	description:
		"Pass a number to start an item on that column line, like `gridColumn(2)`; it spans one column from there:",
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: repeat(3, 1) }), gap(4), demo.track()]}>
			<div mix={[gridColumn(2), demo.block()]}>gridColumn(2)</div>
			<div mix={[gridColumn(3), demo.block()]}>gridColumn(3)</div>
			<div mix={[gridColumn(1), demo.block()]}>gridColumn(1)</div>
		</div>
	),
} satisfies UtilityExampleModule;
