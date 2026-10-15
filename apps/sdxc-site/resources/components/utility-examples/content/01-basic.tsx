/**
 * The opening `content` example: two rows of a tall grid packed together in its middle,
 * with the track stripes showing the free space split above and below them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { content, gap, grid, gridTemplate, repeat } from "sdxc/u/layout";
import { bs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Rows packed into the middle of a tall grid. */
export default {
	title: "Basic example",
	description:
		"Use `content(\"center\")` to gather a grid's or a wrapping flex container's rows in the middle of its block axis:",
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: repeat(3, 1) }),
				content("center"),
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
