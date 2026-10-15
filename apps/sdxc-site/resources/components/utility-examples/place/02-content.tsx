/**
 * A `place` example with `content`: fixed-size tracks in a larger grid spread to its
 * edges on both axes, the stripes showing the room left between them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { grid, gridTemplate, place, repeat } from "sdxc/u/layout";
import { bs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Distributing content moves whole tracks, not the items inside them. */
export default {
	title: "Placing content",
	description:
		'Use the `content` option to distribute the grid\'s tracks inside a larger container on both axes, like `place({ content: "between" })`:',
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: repeat(3, "5rem"), rows: repeat(2, "3rem") }),
				place({ content: "between" }),
				bs(48),
				demo.stripes(),
			]}
		>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
			<div mix={[demo.block()]}>06</div>
		</div>
	),
} satisfies UtilityExampleModule;
