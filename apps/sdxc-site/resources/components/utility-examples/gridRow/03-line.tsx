/**
 * A `gridRow` example with a bare number, starting an item on that row line so the rows
 * before it stay empty.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridColumn, gridRow, gridTemplate, repeat } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A grid item started on a given row line. */
export default {
	title: "Starting on a line",
	description:
		"Pass a number to start an item on that row line, like `gridRow(2)`; it spans one row from there:",
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: repeat(3, 1), rows: repeat(3, "3rem") }),
				gap(4),
				demo.track(),
			]}
		>
			<div mix={[gridColumn(1), gridRow(2), demo.block()]}>gridRow(2)</div>
			<div mix={[gridColumn(2), gridRow(3), demo.block()]}>gridRow(3)</div>
			<div mix={[gridColumn(3), gridRow(1), demo.block()]}>gridRow(1)</div>
		</div>
	),
} satisfies UtilityExampleModule;
