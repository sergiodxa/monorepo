/**
 * The opening `place` example: a grid whose items sit centred in their cells on both
 * axes, with the stripes showing the room each cell leaves around them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridAutoRows, gridTemplate, place, repeat } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Centring items places each one in the middle of its own cell. */
export default {
	title: "Basic example",
	description:
		'Use `place({ items: "center" })` to center grid items inside their cells on both axes at once:',
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: repeat(3, 1) }),
				gridAutoRows(24),
				gap(4),
				place({ items: "center" }),
				demo.stripes(),
			]}
		>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
