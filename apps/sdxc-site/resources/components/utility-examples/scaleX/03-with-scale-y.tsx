/**
 * A `scaleX` example paired with `scaleY` on the same element, since the two axes are
 * separate custom properties that compose into one `scale()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scaleX, scaleY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Independent factors on each axis of one element. */
export default {
	title: "Scaling each axis",
	description: "Combine `scaleX()` with `scaleY()` to resize each axis by its own factor:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[scaleX(1.25), scaleY(0.75), demo.tile()]}>1.25 × 0.75</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scaleX(0.75), scaleY(1.25), demo.tile()]}>0.75 × 1.25</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
