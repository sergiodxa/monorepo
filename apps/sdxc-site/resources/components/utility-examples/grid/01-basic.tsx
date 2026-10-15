/**
 * The only `grid` example: nine boxes placed into a three-column grid, the starting
 * point every other grid utility builds on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate, repeat } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Nine boxes placed into a three-column grid. */
export default {
	title: "Basic example",
	description:
		"Use `grid()` to make an element a grid container, then define its tracks with `gridTemplate()`:",
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: repeat(3, 1) }), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
			<div mix={[demo.block()]}>06</div>
			<div mix={[demo.block()]}>07</div>
			<div mix={[demo.block()]}>08</div>
			<div mix={[demo.block()]}>09</div>
		</div>
	),
} satisfies UtilityExampleModule;
