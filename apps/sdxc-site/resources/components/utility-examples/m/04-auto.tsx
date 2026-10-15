/**
 * An `m` example centring a fixed-width box: an automatic inline margin splits the free
 * space evenly on both sides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, m } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Automatic inline margin centres a box with a width. */
export default {
	title: "Centering with auto",
	description:
		'Pass `"auto"` as the inline margin to center an element that has a width, like `m(0, "auto")`:',
	align: "stretch",
	render: () => (
		<div mix={[demo.track()]}>
			<div mix={[m(0, "auto"), is(64), demo.block()]}>m(0, "auto")</div>
		</div>
	),
} satisfies UtilityExampleModule;
