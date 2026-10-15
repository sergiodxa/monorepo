/**
 * The opening `scale` example: tiles shrunk and grown from their centre, each over a
 * striped ghost the size it started at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scale } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Uniform scaling from a unitless factor. */
export default {
	title: "Basic example",
	description:
		"Use `scale(n)` with a unitless factor, like `scale(0.75)` or `scale(1.25)`, to resize an element on both axes:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[scale(0.75), demo.tile()]}>scale(0.75)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scale(1), demo.tile()]}>scale(1)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scale(1.25), demo.tile()]}>scale(1.25)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
