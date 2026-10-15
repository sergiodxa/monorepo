/**
 * A `translateY` example with a negative step, which moves the element up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { translateY } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Upward translation from a negative step. */
export default {
	title: "Using negative values",
	description: "Pass a negative step, like `translateY(-6)`, to move an element up:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[translateY(-2), demo.tile()]}>translateY(-2)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[translateY(-6), demo.tile()]}>translateY(-6)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
