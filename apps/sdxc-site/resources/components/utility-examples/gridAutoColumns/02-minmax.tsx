/**
 * A `gridAutoColumns` example with a `minmax()` track, so however many columns the grid
 * creates, they share its width equally.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridAutoColumns, gridAutoFlow } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Implicit columns sharing the grid's width equally. */
export default {
	title: "Sharing the width",
	description:
		'Pass a track size like `gridAutoColumns("minmax(0, 1fr)")` to make every implicit column an equal share of the grid\'s width:',
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridAutoFlow("column"), gridAutoColumns("minmax(0, 1fr)"), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
		</div>
	),
} satisfies UtilityExampleModule;
