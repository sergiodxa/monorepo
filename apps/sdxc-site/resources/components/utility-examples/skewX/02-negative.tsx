/**
 * A `skewX` example with negative angles, which slant the element the other way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { skewX } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Horizontal skew in the opposite direction from a negative number. */
export default {
	title: "Using negative values",
	description: "Pass a negative number, like `skewX(-12)`, to slant an element the other way:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[skewX(-6), demo.tile()]}>skewX(-6)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[skewX(-12), demo.tile()]}>skewX(-12)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
