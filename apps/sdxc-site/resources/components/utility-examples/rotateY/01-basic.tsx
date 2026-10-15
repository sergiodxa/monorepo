/**
 * The opening `rotateY` example: tiles swung around their vertical axis inside a parent
 * with perspective, so the near edge grows and the far edge recedes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { perspective, rotateY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Rotation around the vertical axis, seen through the parent's perspective. */
export default {
	title: "Basic example",
	description:
		"Use `rotateY(n)` with a number of degrees to swing an element around its vertical axis, and `perspective()` on the parent to give it depth:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[perspective(400), demo.track()]}>
				<div mix={[rotateY(30), demo.tile()]}>rotateY(30)</div>
			</div>
			<div mix={[perspective(400), demo.track()]}>
				<div mix={[rotateY(50), demo.tile()]}>rotateY(50)</div>
			</div>
			<div mix={[perspective(400), demo.track()]}>
				<div mix={[rotateY(-50), demo.tile()]}>rotateY(-50)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
