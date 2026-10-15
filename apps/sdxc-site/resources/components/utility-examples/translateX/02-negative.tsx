/**
 * A `translateX` example with a negative step, which moves the element toward the start
 * of the line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { translateX } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Horizontal translation the other way from a negative step. */
export default {
	title: "Using negative values",
	description: "Pass a negative step, like `translateX(-6)`, to move an element left:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[translateX(-2), demo.tile()]}>translateX(-2)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[translateX(-6), demo.tile()]}>translateX(-6)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
