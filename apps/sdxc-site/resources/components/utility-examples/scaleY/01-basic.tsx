/**
 * The opening `scaleY` example: tiles stretched and squeezed along the vertical axis only,
 * over striped ghosts of their original size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scaleY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Vertical scaling from a unitless factor. */
export default {
	title: "Basic example",
	description:
		"Use `scaleY(n)` with a unitless factor to resize an element vertically while its width stays the same:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[scaleY(0.5), demo.tile()]}>scaleY(0.5)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scaleY(1), demo.tile()]}>scaleY(1)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scaleY(1.5), demo.tile()]}>scaleY(1.5)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
