/**
 * A `gap` example with two values, which space the rows and the columns of a grid apart
 * by different steps of the scale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate, repeat } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A grid with a narrow gap between rows and a wide one between columns. */
export default {
	title: "Row and column gaps",
	description: "Pass two values to set the row gap and then the column gap, like `gap(2, 8)`:",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: repeat(3, 1) }), gap(2, 8), is(96), demo.stripes()]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
			<div mix={[demo.block()]}>06</div>
		</div>
	),
} satisfies UtilityExampleModule;
