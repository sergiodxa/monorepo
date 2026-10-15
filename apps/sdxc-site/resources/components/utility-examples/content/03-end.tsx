/**
 * A `content` example with `"end"`, packing every row against the bottom of a tall grid
 * and leaving the free space above them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { content, gap, grid, gridTemplate, repeat } from "sdxc/u/layout";
import { bs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Rows packed against the end of a tall grid. */
export default {
	title: "End",
	description:
		'Use `content("end")` to pack the rows against the end of the container\'s block axis:',
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: repeat(3, 1) }),
				content("end"),
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
