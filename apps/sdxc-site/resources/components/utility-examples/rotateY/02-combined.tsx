/**
 * A `rotateY` example combined with `rotateX` and `rotate`, which compose on one element
 * because every transform utility writes its own custom property.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { perspective, rotate, rotateX, rotateY } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Rotation around both 3D axes and the plane at once. */
export default {
	title: "Combining rotations",
	description:
		"Every transform utility composes, so `rotateY()`, `rotateX()` and `rotate()` on one element apply together:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[perspective(400), demo.track()]}>
				<div mix={[rotateY(40), rotateX(20), demo.tile()]}>rotateY + rotateX</div>
			</div>
			<div mix={[perspective(400), demo.track()]}>
				<div mix={[rotateY(-40), rotate(10), demo.tile()]}>rotateY + rotate</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
