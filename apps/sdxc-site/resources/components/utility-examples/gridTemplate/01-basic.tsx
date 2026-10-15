/**
 * The opening `gridTemplate` example: a grid of four equal columns built with `repeat()`,
 * the shape most grids start from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate, repeat } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A grid of four equal columns. */
export default {
	title: "Basic example",
	description:
		"Use `gridTemplate({ columns })` to define a grid's columns, here four equal tracks with `repeat(4, 1)`:",
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: repeat(4, 1) }), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
			<div mix={[demo.block()]}>06</div>
			<div mix={[demo.block()]}>07</div>
			<div mix={[demo.block()]}>08</div>
		</div>
	),
} satisfies UtilityExampleModule;
