/**
 * A `repeat` example with a length as the track: fixed-size columns and rows that keep
 * their size whatever room the grid has.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate, repeat } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A string track passes through, so lengths and other track sizes work too. */
export default {
	title: "Fixed-size tracks",
	description:
		'Pass a length as the track, like `repeat(4, "4rem")`, for columns or rows of a fixed size:',
	render: () => (
		<div
			mix={[grid(), gridTemplate({ columns: repeat(4, "4rem"), rows: repeat(2, "4rem") }), gap(2)]}
		>
			<div mix={[demo.box()]} />
			<div mix={[demo.box()]} />
			<div mix={[demo.box()]} />
			<div mix={[demo.box()]} />
			<div mix={[demo.box()]} />
			<div mix={[demo.box()]} />
			<div mix={[demo.box()]} />
			<div mix={[demo.box()]} />
		</div>
	),
} satisfies UtilityExampleModule;
