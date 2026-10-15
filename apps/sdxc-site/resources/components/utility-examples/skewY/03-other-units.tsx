/**
 * A `skewY` example with string angles, which pass through unchanged for any CSS angle
 * unit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { skewY } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Vertical skew from an angle written in another CSS unit. */
export default {
	title: "Using other angle units",
	description: 'Pass a string to use any CSS angle unit, like `skewY("0.05turn")`:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[skewY("0.05turn"), demo.tile()]}>skewY("0.05turn")</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[skewY("0.2rad"), demo.tile()]}>skewY("0.2rad")</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
