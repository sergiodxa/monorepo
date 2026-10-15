/**
 * A `gridAutoFlow` example with the default `"row"` flow, filling a three-column grid
 * row by row, the order text reads in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridAutoFlow, gridTemplate, repeat } from "sdxc/u/layout";
import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Grid items placed row by row. */
export default {
	title: "Filling rows",
	description:
		"Use `gridAutoFlow()` to fill a grid row by row, the default, creating new rows as items need them:",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: repeat(3, 1) }), gridAutoFlow(), gap(4), is(96)]}>
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
