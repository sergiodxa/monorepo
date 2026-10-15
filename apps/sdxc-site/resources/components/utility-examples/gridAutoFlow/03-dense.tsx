/**
 * A `gridAutoFlow` example with `"row dense"`: a later single-column item backfills the
 * hole a wide item left behind, so the visual order no longer matches the markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridAutoFlow, gridColumn, gridTemplate, repeat } from "sdxc/u/layout";
import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Grid items backfilling earlier holes with the dense packing mode. */
export default {
	title: "Filling holes",
	description:
		'Add `dense`, as in `gridAutoFlow("row dense")`, to let later items fill holes earlier items left. Item 03 moves up beside 01:',
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: repeat(3, 1) }),
				gridAutoFlow("row dense"),
				gap(4),
				is(96),
			]}
		>
			<div mix={[gridColumn("span 2"), demo.block()]}>01</div>
			<div mix={[gridColumn("span 2"), demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
		</div>
	),
} satisfies UtilityExampleModule;
