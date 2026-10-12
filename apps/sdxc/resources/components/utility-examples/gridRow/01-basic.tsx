/**
 * The opening `gridRow` example: items spanning several rows of a three-row grid, the
 * tall cells of a dashboard or a photo collage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridAutoFlow, gridRow, gridTemplate, repeat } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Grid items spanning several rows. */
export default {
	title: "Basic example",
	description: 'Use `gridRow("span n")` to make an item span `n` rows:',
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: repeat(3, 1), rows: repeat(3, "4rem") }),
				gridAutoFlow("column"),
				gap(4),
			]}
		>
			<div mix={[gridRow("span 3"), demo.block()]}>gridRow("span 3")</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[gridRow("span 2"), demo.block()]}>gridRow("span 2")</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
			<div mix={[demo.block()]}>06</div>
		</div>
	),
} satisfies UtilityExampleModule;
