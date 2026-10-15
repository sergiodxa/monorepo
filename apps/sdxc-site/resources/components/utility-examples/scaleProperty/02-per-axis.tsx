/**
 * A `scaleProperty` example with a two-value string, which scales the horizontal and
 * vertical axes apart in one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scaleProperty } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Separate horizontal and vertical factors in one `scale` value. */
export default {
	title: "Scaling each axis",
	description:
		'Pass a string with two factors, like `scaleProperty("1.25 0.75")`, to scale the horizontal and vertical axes apart:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[scaleProperty("1.25 0.75"), demo.tile()]}>1.25 0.75</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scaleProperty("0.75 1.25"), demo.tile()]}>0.75 1.25</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
