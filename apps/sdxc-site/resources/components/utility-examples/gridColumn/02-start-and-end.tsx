/**
 * A `gridColumn` example with `"start / end"` lines, placing items between two numbered
 * lines of a six-column grid, `-1` counting from the last line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridColumn, gridTemplate, repeat } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Grid items placed between a start line and an end line. */
export default {
	title: "Starting and ending lines",
	description:
		'Pass `"start / end"` line numbers to place an item between two grid lines, with negative numbers counting back from the end:',
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: repeat(6, 1) }), gap(4)]}>
			<div mix={[gridColumn("2 / 5"), demo.block()]}>gridColumn("2 / 5")</div>
			<div mix={[gridColumn("1 / 3"), demo.block()]}>gridColumn("1 / 3")</div>
			<div mix={[gridColumn("4 / -1"), demo.block()]}>gridColumn("4 / -1")</div>
			<div mix={[gridColumn("1 / -1"), demo.block()]}>gridColumn("1 / -1")</div>
		</div>
	),
} satisfies UtilityExampleModule;
