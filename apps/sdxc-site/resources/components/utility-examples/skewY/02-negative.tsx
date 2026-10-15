/**
 * A `skewY` example with negative angles, which slant the element the other way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { skewY } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Vertical skew in the opposite direction from a negative number. */
export default {
	title: "Using negative values",
	description: "Pass a negative number, like `skewY(-12)`, to slant an element the other way:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[skewY(-6), demo.tile()]}>skewY(-6)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[skewY(-12), demo.tile()]}>skewY(-12)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
