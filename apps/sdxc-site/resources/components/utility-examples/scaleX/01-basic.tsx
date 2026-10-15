/**
 * The opening `scaleX` example: tiles stretched and squeezed along the horizontal axis
 * only, over striped ghosts of their original size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scaleX } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Horizontal scaling from a unitless factor. */
export default {
	title: "Basic example",
	description:
		"Use `scaleX(n)` with a unitless factor to resize an element horizontally while its height stays the same:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[scaleX(0.5), demo.tile()]}>scaleX(0.5)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scaleX(1), demo.tile()]}>scaleX(1)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scaleX(1.5), demo.tile()]}>scaleX(1.5)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
