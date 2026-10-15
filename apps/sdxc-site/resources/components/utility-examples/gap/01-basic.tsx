/**
 * The opening `gap` example: a grid of four boxes with one step of the spacing scale
 * between them, the stripes behind showing the space the gap reserves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate, repeat } from "sdxc/u/layout";
import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A grid with the same gap between its rows and its columns. */
export default {
	title: "Basic example",
	description:
		"Use `gap(n)` with a step of the spacing scale, like `gap(4)` or `gap(8)`, to space the rows and columns of a grid or flex container:",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: repeat(2, 1) }), gap(4), is(80), demo.stripes()]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
		</div>
	),
} satisfies UtilityExampleModule;
