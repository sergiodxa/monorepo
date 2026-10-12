/**
 * The opening `gridAutoColumns` example: a grid that adds a column per item, each of the
 * implicit columns sized from one step of the spacing scale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridAutoColumns, gridAutoFlow } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Implicit grid columns sized from the spacing scale. */
export default {
	title: "Basic example",
	description:
		'Use `gridAutoColumns(n)` to size the columns a grid creates on its own, here one per item with `gridAutoFlow("column")`:',
	render: () => (
		<div mix={[grid(), gridAutoFlow("column"), gridAutoColumns(24), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
