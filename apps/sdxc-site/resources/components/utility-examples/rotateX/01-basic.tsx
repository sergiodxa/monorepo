/**
 * The opening `rotateX` example: tiles tipped back around their horizontal axis inside
 * a parent with perspective, so the turn reads as depth rather than a squash.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { perspective, rotateX } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Rotation around the horizontal axis, seen through the parent's perspective. */
export default {
	title: "Basic example",
	description:
		"Use `rotateX(n)` with a number of degrees to tip an element around its horizontal axis, and `perspective()` on the parent to give it depth:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[perspective(400), demo.track()]}>
				<div mix={[rotateX(30), demo.tile()]}>rotateX(30)</div>
			</div>
			<div mix={[perspective(400), demo.track()]}>
				<div mix={[rotateX(50), demo.tile()]}>rotateX(50)</div>
			</div>
			<div mix={[perspective(400), demo.track()]}>
				<div mix={[rotateX(-50), demo.tile()]}>rotateX(-50)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
