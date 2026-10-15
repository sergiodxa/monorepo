/**
 * The opening `repeat` example: three equal fractional columns built with one call, the
 * track list most grids start from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate, repeat } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A bare number as the track repeats that many fractions of the free space. */
export default {
	title: "Basic example",
	description:
		"Use `repeat(count, track)` to build a track list for `gridTemplate()`, where a bare number like `repeat(3, 1)` means equal `1fr` columns:",
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: repeat(3, 1) }), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
			<div mix={[demo.block()]}>06</div>
		</div>
	),
} satisfies UtilityExampleModule;
