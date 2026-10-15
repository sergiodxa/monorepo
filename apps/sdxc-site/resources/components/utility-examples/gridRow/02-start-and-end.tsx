/**
 * A `gridRow` example with `"start / end"` lines, placing items between two numbered row
 * lines, `-1` counting from the last line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridAutoFlow, gridRow, gridTemplate, repeat } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Grid items placed between a start row line and an end row line. */
export default {
	title: "Starting and ending lines",
	description:
		'Pass `"start / end"` line numbers to place an item between two row lines, with negative numbers counting back from the end:',
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: repeat(3, 1), rows: repeat(3, "4rem") }),
				gridAutoFlow("column"),
				gap(4),
				demo.track(),
			]}
		>
			<div mix={[gridRow("1 / -1"), demo.block()]}>gridRow("1 / -1")</div>
			<div mix={[gridRow("2 / 4"), demo.block()]}>gridRow("2 / 4")</div>
			<div mix={[gridRow("1 / 3"), demo.block()]}>gridRow("1 / 3")</div>
		</div>
	),
} satisfies UtilityExampleModule;
