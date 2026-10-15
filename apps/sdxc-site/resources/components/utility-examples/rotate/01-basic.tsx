/**
 * The opening `rotate` example: three tiles turned by growing angles, each over a
 * striped ghost of where it sat, so the turn reads against the unrotated box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rotate } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Rotation in degrees from a bare number. */
export default {
	title: "Basic example",
	description:
		"Use `rotate(n)` with a number of degrees, like `rotate(45)` or `rotate(90)`, to turn an element in its own plane:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[rotate(45), demo.tile()]}>rotate(45)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[rotate(90), demo.tile()]}>rotate(90)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[rotate(210), demo.tile()]}>rotate(210)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
