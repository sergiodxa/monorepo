/**
 * A `content` example with `"evenly"`, the alias for `space-evenly`, so every gap of a tall
 * grid, including the two at its edges, is the same size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { content, gap, grid, gridTemplate, repeat } from "sdxc/u/layout";
import { bs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Rows spaced so every gap is equal, the edges included. */
export default {
	title: "Space evenly",
	description:
		'Use `content("evenly")` to make every gap, the ones at the edges included, the same size:',
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: repeat(3, 1) }),
				content("evenly"),
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
