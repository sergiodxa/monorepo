/**
 * A `content` example with `"around"`, the alias for `space-around`, so each row of a tall
 * grid gets an equal share of free space on both of its sides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { content, gap, grid, gridTemplate, repeat } from "@sdxc/u/layout";
import { bs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Rows each given equal free space above and below. */
export default {
	title: "Space around",
	description:
		'Use `content("around")` to give each row an equal share of free space on both sides:',
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: repeat(3, 1) }),
				content("around"),
				gap(4),
				bs(64),
				demo.track(),
			]}
		>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
		</div>
	),
} satisfies UtilityExampleModule;
