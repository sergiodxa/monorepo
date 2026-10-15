/**
 * The opening `skewX` example: tiles slanted along the horizontal axis by growing
 * angles, over striped ghosts of their unslanted box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { skewX } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Horizontal skew in degrees from a bare number. */
export default {
	title: "Basic example",
	description:
		"Use `skewX(n)` with a number of degrees to slant an element along its horizontal axis:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[skewX(6), demo.tile()]}>skewX(6)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[skewX(12), demo.tile()]}>skewX(12)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[skewX(24), demo.tile()]}>skewX(24)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
