/**
 * A `rotate` example with negative angles, which turn the element counterclockwise,
 * set beside a positive one so the two directions read side by side.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rotate } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Counterclockwise rotation from a negative number. */
export default {
	title: "Using negative values",
	description: "Pass a negative number, like `rotate(-15)`, to turn an element counterclockwise:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[rotate(-15), demo.tile()]}>rotate(-15)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[rotate(-45), demo.tile()]}>rotate(-45)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[rotate(15), demo.tile()]}>rotate(15)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
