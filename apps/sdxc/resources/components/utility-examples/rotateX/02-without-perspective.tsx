/**
 * A `rotateX` example comparing a parent with and without perspective, which shows
 * why a 3D rotation needs one: without it the tile only shrinks vertically.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { perspective, rotateX } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The same rotation with and without a perspective on the parent. */
export default {
	title: "Adding perspective",
	description:
		"Without a `perspective()` on the parent, `rotateX()` reads as a flat vertical squash; with one, the far edge recedes:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[rotateX(55), demo.tile()]}>flat</div>
			</div>
			<div mix={[perspective(300), demo.track()]}>
				<div mix={[rotateX(55), demo.tile()]}>perspective(300)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
