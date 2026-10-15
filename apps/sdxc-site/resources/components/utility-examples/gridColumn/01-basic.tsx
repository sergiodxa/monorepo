/**
 * The opening `gridColumn` example: items spanning two and three columns of a three-column
 * grid, the most common way to make one cell wider than the rest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridColumn, gridTemplate, repeat } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Grid items spanning several columns. */
export default {
	title: "Basic example",
	description: 'Use `gridColumn("span n")` to make an item span `n` columns:',
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: repeat(3, 1) }), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[gridColumn("span 2"), demo.block()]}>gridColumn("span 2")</div>
			<div mix={[demo.block()]}>05</div>
			<div mix={[gridColumn("span 3"), demo.block()]}>gridColumn("span 3")</div>
		</div>
	),
} satisfies UtilityExampleModule;
