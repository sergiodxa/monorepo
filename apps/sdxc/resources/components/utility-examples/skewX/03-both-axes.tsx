/**
 * A `skewX` example paired with `skewY`, since the two axes are separate custom
 * properties that compose into one `skew()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { skewX, skewY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Skew on both axes of one element. */
export default {
	title: "Skewing both axes",
	description: "Combine `skewX()` with `skewY()` to slant an element along both axes:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[skewX(12), skewY(6), demo.tile()]}>12 / 6</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[skewX(-12), skewY(-6), demo.tile()]}>-12 / -6</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
