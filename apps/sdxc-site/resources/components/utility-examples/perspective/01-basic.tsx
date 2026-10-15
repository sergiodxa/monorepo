/**
 * The opening `perspective` example: the same tipped tile under three viewer distances,
 * so a short distance reads as dramatic depth and a long one as nearly flat.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { perspective, rotateX } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Viewer distances in pixels from a bare number, set on the parent of a 3D-rotated tile. */
export default {
	title: "Basic example",
	description:
		"Use `perspective(n)` on the parent of a 3D-transformed element to set how far away the viewer is, in pixels; closer reads as more dramatic:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[perspective(150), demo.track()]}>
				<div mix={[rotateX(45), demo.tile()]}>perspective(150)</div>
			</div>
			<div mix={[perspective(400), demo.track()]}>
				<div mix={[rotateX(45), demo.tile()]}>perspective(400)</div>
			</div>
			<div mix={[perspective(1000), demo.track()]}>
				<div mix={[rotateX(45), demo.tile()]}>perspective(1000)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
