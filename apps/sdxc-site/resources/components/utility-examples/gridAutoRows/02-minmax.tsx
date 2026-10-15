/**
 * A `gridAutoRows` example with a `minmax()` track: rows keep a minimum height and grow
 * when an item's content needs more.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridAutoRows, gridTemplate, repeat } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Implicit rows with a minimum height that grow to fit their content. */
export default {
	title: "Growing past a minimum",
	description:
		'Pass a track size like `gridAutoRows("minmax(4rem, auto)")` to give rows a minimum height they grow past when their content needs room:',
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: repeat(3, 1) }),
				gridAutoRows("minmax(4rem, auto)"),
				gap(4),
			]}
		>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05 has more text, so its row grows</div>
			<div mix={[demo.block()]}>06</div>
		</div>
	),
} satisfies UtilityExampleModule;
